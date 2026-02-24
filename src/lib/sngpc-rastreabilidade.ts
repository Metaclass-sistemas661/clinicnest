// SNGPC - Rastreabilidade por Lote
// Rastreamento completo: Lote → Paciente → Prescritor

export interface RastreioLote {
  lote: string;
  medicamento: {
    codigo: string;
    nome: string;
    lista: string;
  };
  fabricante?: string;
  dataFabricacao?: string;
  dataValidade: string;
  quantidadeRecebida: number;
  quantidadeDispensada: number;
  quantidadeAtual: number;
  quantidadePerda: number;
  entrada: {
    data: string;
    notaFiscal?: string;
    fornecedor?: string;
    usuario: string;
  };
  dispensacoes: DispensacaoRastreio[];
  perdas: PerdaRastreio[];
}

export interface DispensacaoRastreio {
  id: string;
  data: string;
  quantidade: number;
  paciente: {
    id: string;
    nome: string;
    cpf?: string;
  };
  prescritor: {
    nome: string;
    crm: string;
    uf: string;
  };
  receita: {
    numero: string;
    data: string;
  };
  comprador?: {
    nome: string;
    rg?: string;
    parentesco?: string;
  };
  usuario: string;
}

export interface PerdaRastreio {
  id: string;
  data: string;
  quantidade: number;
  tipo: 'PERDA' | 'VENCIMENTO' | 'APREENSAO' | 'ROUBO';
  motivo: string;
  boletimOcorrencia?: string;
  usuario: string;
}

export interface RastreioPaciente {
  paciente: {
    id: string;
    nome: string;
    cpf?: string;
    dataNascimento?: string;
  };
  dispensacoes: {
    data: string;
    medicamento: {
      codigo: string;
      nome: string;
      lista: string;
    };
    lote: string;
    quantidade: number;
    prescritor: {
      nome: string;
      crm: string;
    };
    receita: string;
  }[];
  totalDispensacoes: number;
  medicamentosDistintos: number;
  ultimaDispensacao?: string;
}

export interface RastreioPrescritor {
  prescritor: {
    nome: string;
    crm: string;
    uf: string;
    especialidade?: string;
  };
  prescricoes: {
    data: string;
    paciente: {
      nome: string;
      cpf?: string;
    };
    medicamento: {
      codigo: string;
      nome: string;
      lista: string;
    };
    quantidade: number;
    receita: string;
  }[];
  totalPrescricoes: number;
  pacientesDistintos: number;
  medicamentosDistintos: number;
  ultimaPrescricao?: string;
}

// Gerar relatório de rastreio por lote
export function gerarRelatorioRastreioLoteHTML(rastreio: RastreioLote): string {
  const { lote, medicamento, entrada, dispensacoes, perdas } = rastreio;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Rastreio de Lote - ${lote}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 10mm; border-bottom: 2px solid #000; padding-bottom: 5mm; }
    .header h1 { font-size: 16pt; margin-bottom: 3mm; }
    .info-box { border: 1px solid #ccc; padding: 5mm; margin-bottom: 5mm; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
    .info-item { margin: 2mm 0; }
    .info-item strong { display: inline-block; min-width: 120px; }
    table { width: 100%; border-collapse: collapse; margin: 5mm 0; }
    th, td { border: 1px solid #000; padding: 2mm; text-align: left; }
    th { background: #e0e0e0; }
    .section-title { font-size: 12pt; font-weight: bold; margin: 5mm 0 3mm 0; background: #333; color: white; padding: 2mm 5mm; }
    .resumo { background: #f5f5f5; padding: 5mm; margin: 5mm 0; }
    .alerta { color: #c00; font-weight: bold; }
    .ok { color: #080; }
    .timeline { border-left: 3px solid #333; padding-left: 10mm; margin: 5mm 0; }
    .timeline-item { margin: 3mm 0; padding: 3mm; background: #f9f9f9; position: relative; }
    .timeline-item::before { content: ''; position: absolute; left: -13mm; top: 5mm; width: 8px; height: 8px; background: #333; border-radius: 50%; }
    .timeline-entrada::before { background: #4caf50; }
    .timeline-saida::before { background: #2196f3; }
    .timeline-perda::before { background: #f44336; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO DE RASTREABILIDADE POR LOTE</h1>
    <p>Sistema Nacional de Gerenciamento de Produtos Controlados - SNGPC</p>
  </div>
  
  <div class="info-box">
    <div class="info-grid">
      <div>
        <div class="info-item"><strong>Lote:</strong> ${lote}</div>
        <div class="info-item"><strong>Medicamento:</strong> ${medicamento.nome}</div>
        <div class="info-item"><strong>Código:</strong> ${medicamento.codigo}</div>
        <div class="info-item"><strong>Lista:</strong> ${medicamento.lista}</div>
      </div>
      <div>
        <div class="info-item"><strong>Fabricante:</strong> ${rastreio.fabricante || 'N/I'}</div>
        <div class="info-item"><strong>Fabricação:</strong> ${rastreio.dataFabricacao ? new Date(rastreio.dataFabricacao).toLocaleDateString('pt-BR') : 'N/I'}</div>
        <div class="info-item"><strong>Validade:</strong> ${new Date(rastreio.dataValidade).toLocaleDateString('pt-BR')}</div>
        <div class="info-item"><strong>Status:</strong> ${verificarStatusLote(rastreio)}</div>
      </div>
    </div>
  </div>
  
  <div class="resumo">
    <strong>RESUMO DO LOTE</strong>
    <div class="info-grid" style="margin-top: 3mm;">
      <div>
        <div class="info-item"><strong>Quantidade Recebida:</strong> ${rastreio.quantidadeRecebida}</div>
        <div class="info-item"><strong>Quantidade Dispensada:</strong> ${rastreio.quantidadeDispensada}</div>
      </div>
      <div>
        <div class="info-item"><strong>Perdas/Baixas:</strong> ${rastreio.quantidadePerda}</div>
        <div class="info-item"><strong>Saldo Atual:</strong> <span class="${rastreio.quantidadeAtual === 0 ? 'alerta' : 'ok'}">${rastreio.quantidadeAtual}</span></div>
      </div>
    </div>
    <div style="margin-top: 3mm;">
      <strong>Conferência:</strong> 
      ${verificarConferenciaLote(rastreio)}
    </div>
  </div>
  
  <div class="section-title">ENTRADA DO LOTE</div>
  <div class="info-box">
    <div class="info-item"><strong>Data de Entrada:</strong> ${new Date(entrada.data).toLocaleDateString('pt-BR')}</div>
    <div class="info-item"><strong>Nota Fiscal:</strong> ${entrada.notaFiscal || 'N/I'}</div>
    <div class="info-item"><strong>Fornecedor:</strong> ${entrada.fornecedor || 'N/I'}</div>
    <div class="info-item"><strong>Registrado por:</strong> ${entrada.usuario}</div>
  </div>
  
  <div class="section-title">DISPENSAÇÕES (${dispensacoes.length})</div>
  ${dispensacoes.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Paciente</th>
        <th>CPF</th>
        <th>Prescritor</th>
        <th>CRM</th>
        <th>Receita</th>
        <th>Qtd</th>
        <th>Comprador</th>
      </tr>
    </thead>
    <tbody>
      ${dispensacoes.map(d => `
      <tr>
        <td>${new Date(d.data).toLocaleDateString('pt-BR')}</td>
        <td>${d.paciente.nome}</td>
        <td>${d.paciente.cpf || '-'}</td>
        <td>${d.prescritor.nome}</td>
        <td>${d.prescritor.crm}/${d.prescritor.uf}</td>
        <td>${d.receita.numero}</td>
        <td>${d.quantidade}</td>
        <td>${d.comprador ? `${d.comprador.nome} (${d.comprador.parentesco || 'N/I'})` : 'Próprio paciente'}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>Nenhuma dispensação registrada para este lote.</p>'}
  
  ${perdas.length > 0 ? `
  <div class="section-title">PERDAS/BAIXAS (${perdas.length})</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Tipo</th>
        <th>Quantidade</th>
        <th>Motivo</th>
        <th>B.O.</th>
        <th>Registrado por</th>
      </tr>
    </thead>
    <tbody>
      ${perdas.map(p => `
      <tr>
        <td>${new Date(p.data).toLocaleDateString('pt-BR')}</td>
        <td class="alerta">${p.tipo}</td>
        <td>${p.quantidade}</td>
        <td>${p.motivo}</td>
        <td>${p.boletimOcorrencia || '-'}</td>
        <td>${p.usuario}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  <div class="section-title">LINHA DO TEMPO</div>
  <div class="timeline">
    <div class="timeline-item timeline-entrada">
      <strong>${new Date(entrada.data).toLocaleDateString('pt-BR')}</strong> - 
      ENTRADA: ${rastreio.quantidadeRecebida} unidades (NF: ${entrada.notaFiscal || 'N/I'})
    </div>
    ${gerarTimelineMovimentacoes(dispensacoes, perdas)}
  </div>
  
  <div style="margin-top: 10mm; font-size: 8pt; color: #666;">
    Relatório gerado em: ${new Date().toLocaleString('pt-BR')}<br>
    Este documento é parte integrante do controle SNGPC.
  </div>
</body>
</html>`;
}

function verificarStatusLote(rastreio: RastreioLote): string {
  const hoje = new Date();
  const validade = new Date(rastreio.dataValidade);
  const diasParaVencer = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diasParaVencer < 0) {
    return '<span class="alerta">VENCIDO</span>';
  } else if (diasParaVencer <= 30) {
    return '<span class="alerta">PRÓXIMO DO VENCIMENTO</span>';
  } else if (rastreio.quantidadeAtual === 0) {
    return '<span class="ok">ESGOTADO</span>';
  } else {
    return '<span class="ok">ATIVO</span>';
  }
}

function verificarConferenciaLote(rastreio: RastreioLote): string {
  const calculado = rastreio.quantidadeRecebida - rastreio.quantidadeDispensada - rastreio.quantidadePerda;
  
  if (calculado === rastreio.quantidadeAtual) {
    return '<span class="ok">✓ Saldo confere com movimentações</span>';
  } else {
    const diferenca = rastreio.quantidadeAtual - calculado;
    return `<span class="alerta">✗ Divergência de ${diferenca} unidades (esperado: ${calculado}, atual: ${rastreio.quantidadeAtual})</span>`;
  }
}

function gerarTimelineMovimentacoes(
  dispensacoes: DispensacaoRastreio[],
  perdas: PerdaRastreio[]
): string {
  const eventos: { data: string; tipo: 'saida' | 'perda'; html: string }[] = [];
  
  dispensacoes.forEach(d => {
    eventos.push({
      data: d.data,
      tipo: 'saida',
      html: `<div class="timeline-item timeline-saida">
        <strong>${new Date(d.data).toLocaleDateString('pt-BR')}</strong> - 
        DISPENSAÇÃO: ${d.quantidade} un. para ${d.paciente.nome} (Receita: ${d.receita.numero})
      </div>`,
    });
  });
  
  perdas.forEach(p => {
    eventos.push({
      data: p.data,
      tipo: 'perda',
      html: `<div class="timeline-item timeline-perda">
        <strong>${new Date(p.data).toLocaleDateString('pt-BR')}</strong> - 
        ${p.tipo}: ${p.quantidade} un. - ${p.motivo}
      </div>`,
    });
  });
  
  eventos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  
  return eventos.map(e => e.html).join('');
}

// Gerar relatório de rastreio por paciente
export function gerarRelatorioRastreioPacienteHTML(rastreio: RastreioPaciente): string {
  const { paciente, dispensacoes } = rastreio;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Rastreio de Paciente - ${paciente.nome}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 10mm; border-bottom: 2px solid #000; padding-bottom: 5mm; }
    .header h1 { font-size: 16pt; margin-bottom: 3mm; }
    .info-box { border: 1px solid #ccc; padding: 5mm; margin-bottom: 5mm; }
    .info-item { margin: 2mm 0; }
    .info-item strong { display: inline-block; min-width: 150px; }
    table { width: 100%; border-collapse: collapse; margin: 5mm 0; }
    th, td { border: 1px solid #000; padding: 2mm; text-align: left; }
    th { background: #e0e0e0; }
    .section-title { font-size: 12pt; font-weight: bold; margin: 5mm 0 3mm 0; background: #333; color: white; padding: 2mm 5mm; }
    .resumo { background: #f5f5f5; padding: 5mm; margin: 5mm 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .resumo-item { text-align: center; }
    .resumo-valor { font-size: 18pt; font-weight: bold; color: #333; }
    .resumo-label { font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO DE RASTREABILIDADE POR PACIENTE</h1>
    <p>Sistema Nacional de Gerenciamento de Produtos Controlados - SNGPC</p>
  </div>
  
  <div class="info-box">
    <div class="info-item"><strong>Nome do Paciente:</strong> ${paciente.nome}</div>
    <div class="info-item"><strong>CPF:</strong> ${paciente.cpf || 'Não informado'}</div>
    <div class="info-item"><strong>Data de Nascimento:</strong> ${paciente.dataNascimento ? new Date(paciente.dataNascimento).toLocaleDateString('pt-BR') : 'Não informada'}</div>
  </div>
  
  <div class="resumo">
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.totalDispensacoes}</div>
      <div class="resumo-label">Total de Dispensações</div>
    </div>
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.medicamentosDistintos}</div>
      <div class="resumo-label">Medicamentos Distintos</div>
    </div>
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.ultimaDispensacao ? new Date(rastreio.ultimaDispensacao).toLocaleDateString('pt-BR') : '-'}</div>
      <div class="resumo-label">Última Dispensação</div>
    </div>
  </div>
  
  <div class="section-title">HISTÓRICO DE DISPENSAÇÕES</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Medicamento</th>
        <th>Lista</th>
        <th>Lote</th>
        <th>Quantidade</th>
        <th>Prescritor</th>
        <th>Receita</th>
      </tr>
    </thead>
    <tbody>
      ${dispensacoes.map(d => `
      <tr>
        <td>${new Date(d.data).toLocaleDateString('pt-BR')}</td>
        <td>${d.medicamento.nome}</td>
        <td>${d.medicamento.lista}</td>
        <td>${d.lote}</td>
        <td>${d.quantidade}</td>
        <td>${d.prescritor.nome} (CRM ${d.prescritor.crm})</td>
        <td>${d.receita}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div style="margin-top: 10mm; font-size: 8pt; color: #666;">
    Relatório gerado em: ${new Date().toLocaleString('pt-BR')}<br>
    Este documento é parte integrante do controle SNGPC.
  </div>
</body>
</html>`;
}

// Gerar relatório de rastreio por prescritor
export function gerarRelatorioRastreioPrescritorHTML(rastreio: RastreioPrescritor): string {
  const { prescritor, prescricoes } = rastreio;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Rastreio de Prescritor - ${prescritor.nome}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 10mm; border-bottom: 2px solid #000; padding-bottom: 5mm; }
    .header h1 { font-size: 16pt; margin-bottom: 3mm; }
    .info-box { border: 1px solid #ccc; padding: 5mm; margin-bottom: 5mm; }
    .info-item { margin: 2mm 0; }
    .info-item strong { display: inline-block; min-width: 150px; }
    table { width: 100%; border-collapse: collapse; margin: 5mm 0; }
    th, td { border: 1px solid #000; padding: 2mm; text-align: left; }
    th { background: #e0e0e0; }
    .section-title { font-size: 12pt; font-weight: bold; margin: 5mm 0 3mm 0; background: #333; color: white; padding: 2mm 5mm; }
    .resumo { background: #f5f5f5; padding: 5mm; margin: 5mm 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }
    .resumo-item { text-align: center; }
    .resumo-valor { font-size: 18pt; font-weight: bold; color: #333; }
    .resumo-label { font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO DE RASTREABILIDADE POR PRESCRITOR</h1>
    <p>Sistema Nacional de Gerenciamento de Produtos Controlados - SNGPC</p>
  </div>
  
  <div class="info-box">
    <div class="info-item"><strong>Nome do Prescritor:</strong> ${prescritor.nome}</div>
    <div class="info-item"><strong>CRM:</strong> ${prescritor.crm}/${prescritor.uf}</div>
    <div class="info-item"><strong>Especialidade:</strong> ${prescritor.especialidade || 'Não informada'}</div>
  </div>
  
  <div class="resumo">
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.totalPrescricoes}</div>
      <div class="resumo-label">Total de Prescrições</div>
    </div>
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.pacientesDistintos}</div>
      <div class="resumo-label">Pacientes Distintos</div>
    </div>
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.medicamentosDistintos}</div>
      <div class="resumo-label">Medicamentos Distintos</div>
    </div>
    <div class="resumo-item">
      <div class="resumo-valor">${rastreio.ultimaPrescricao ? new Date(rastreio.ultimaPrescricao).toLocaleDateString('pt-BR') : '-'}</div>
      <div class="resumo-label">Última Prescrição</div>
    </div>
  </div>
  
  <div class="section-title">HISTÓRICO DE PRESCRIÇÕES</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Paciente</th>
        <th>CPF</th>
        <th>Medicamento</th>
        <th>Lista</th>
        <th>Quantidade</th>
        <th>Receita</th>
      </tr>
    </thead>
    <tbody>
      ${prescricoes.map(p => `
      <tr>
        <td>${new Date(p.data).toLocaleDateString('pt-BR')}</td>
        <td>${p.paciente.nome}</td>
        <td>${p.paciente.cpf || '-'}</td>
        <td>${p.medicamento.nome}</td>
        <td>${p.medicamento.lista}</td>
        <td>${p.quantidade}</td>
        <td>${p.receita}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div style="margin-top: 10mm; font-size: 8pt; color: #666;">
    Relatório gerado em: ${new Date().toLocaleString('pt-BR')}<br>
    Este documento é parte integrante do controle SNGPC.
  </div>
</body>
</html>`;
}

// Buscar lotes por medicamento
export function buscarLotesPorMedicamento(
  lotes: RastreioLote[],
  medicamentoCodigo: string
): RastreioLote[] {
  return lotes.filter(l => l.medicamento.codigo === medicamentoCodigo);
}

// Buscar dispensações por período
export function buscarDispensacoesPorPeriodo(
  dispensacoes: DispensacaoRastreio[],
  dataInicio: string,
  dataFim: string
): DispensacaoRastreio[] {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  
  return dispensacoes.filter(d => {
    const data = new Date(d.data);
    return data >= inicio && data <= fim;
  });
}

// Verificar integridade do rastreio
export function verificarIntegridadeRastreio(rastreio: RastreioLote): {
  integro: boolean;
  problemas: string[];
} {
  const problemas: string[] = [];
  
  // Verificar saldo
  const saldoCalculado = rastreio.quantidadeRecebida - rastreio.quantidadeDispensada - rastreio.quantidadePerda;
  if (saldoCalculado !== rastreio.quantidadeAtual) {
    problemas.push(`Saldo não confere: esperado ${saldoCalculado}, atual ${rastreio.quantidadeAtual}`);
  }
  
  // Verificar dispensações sem receita
  const semReceita = rastreio.dispensacoes.filter(d => !d.receita.numero);
  if (semReceita.length > 0) {
    problemas.push(`${semReceita.length} dispensação(ões) sem número de receita`);
  }
  
  // Verificar dispensações sem prescritor
  const semPrescritor = rastreio.dispensacoes.filter(d => !d.prescritor.crm);
  if (semPrescritor.length > 0) {
    problemas.push(`${semPrescritor.length} dispensação(ões) sem CRM do prescritor`);
  }
  
  // Verificar perdas sem motivo
  const perdasSemMotivo = rastreio.perdas.filter(p => !p.motivo);
  if (perdasSemMotivo.length > 0) {
    problemas.push(`${perdasSemMotivo.length} perda(s) sem motivo registrado`);
  }
  
  // Verificar roubo/furto sem B.O.
  const rouboSemBO = rastreio.perdas.filter(p => p.tipo === 'ROUBO' && !p.boletimOcorrencia);
  if (rouboSemBO.length > 0) {
    problemas.push(`${rouboSemBO.length} roubo(s)/furto(s) sem boletim de ocorrência`);
  }
  
  return {
    integro: problemas.length === 0,
    problemas,
  };
}
