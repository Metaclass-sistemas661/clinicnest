// SNGPC - Balanço de Substâncias Psicoativas e Outras (BSPO)
// Relatório trimestral/anual conforme RDC 22/2014

export interface DadosBalanco {
  estabelecimento: {
    cnpj: string;
    razaoSocial: string;
    autorizacaoAnvisa: string;
    responsavelTecnico: string;
    crf: string;
  };
  periodo: {
    tipo: 'TRIMESTRAL' | 'ANUAL';
    ano: number;
    trimestre?: 1 | 2 | 3 | 4;
    dataInicio: string;
    dataFim: string;
  };
  itens: ItemBalanco[];
}

export interface ItemBalanco {
  medicamento: {
    codigo: string;
    nome: string;
    lista: string;
    apresentacao: string;
    unidade: string;
  };
  estoqueInicial: number;
  entradas: {
    compras: number;
    transferencias: number;
    devolucoes: number;
    outros: number;
    total: number;
  };
  saidas: {
    vendas: number;
    transferencias: number;
    perdas: number;
    vencimentos: number;
    apreensoes: number;
    outros: number;
    total: number;
  };
  estoqueFinal: number;
  diferencaInventario: number;
  observacoes?: string;
}

export interface ResumoBalanco {
  totalItens: number;
  porLista: Record<string, {
    itens: number;
    estoqueInicial: number;
    entradas: number;
    saidas: number;
    estoqueFinal: number;
  }>;
  alertas: string[];
}

// Calcular período do balanço
export function calcularPeriodoBalanco(
  tipo: 'TRIMESTRAL' | 'ANUAL',
  ano: number,
  trimestre?: 1 | 2 | 3 | 4
): { dataInicio: string; dataFim: string } {
  if (tipo === 'ANUAL') {
    return {
      dataInicio: `${ano}-01-01`,
      dataFim: `${ano}-12-31`,
    };
  }
  
  const trimestres = {
    1: { inicio: '01-01', fim: '03-31' },
    2: { inicio: '04-01', fim: '06-30' },
    3: { inicio: '07-01', fim: '09-30' },
    4: { inicio: '10-01', fim: '12-31' },
  };
  
  const t = trimestres[trimestre || 1];
  return {
    dataInicio: `${ano}-${t.inicio}`,
    dataFim: `${ano}-${t.fim}`,
  };
}

// Gerar resumo do balanço
export function gerarResumoBalanco(dados: DadosBalanco): ResumoBalanco {
  const resumo: ResumoBalanco = {
    totalItens: dados.itens.length,
    porLista: {},
    alertas: [],
  };
  
  dados.itens.forEach((item) => {
    const lista = item.medicamento.lista;
    
    if (!resumo.porLista[lista]) {
      resumo.porLista[lista] = {
        itens: 0,
        estoqueInicial: 0,
        entradas: 0,
        saidas: 0,
        estoqueFinal: 0,
      };
    }
    
    resumo.porLista[lista].itens++;
    resumo.porLista[lista].estoqueInicial += item.estoqueInicial;
    resumo.porLista[lista].entradas += item.entradas.total;
    resumo.porLista[lista].saidas += item.saidas.total;
    resumo.porLista[lista].estoqueFinal += item.estoqueFinal;
    
    // Verificar divergências
    const calculado = item.estoqueInicial + item.entradas.total - item.saidas.total;
    if (calculado !== item.estoqueFinal) {
      resumo.alertas.push(
        `${item.medicamento.nome}: Divergência de ${item.estoqueFinal - calculado} unidades`
      );
    }
    
    // Verificar perdas significativas
    if (item.saidas.perdas > 0) {
      const percentualPerda = (item.saidas.perdas / (item.estoqueInicial + item.entradas.total)) * 100;
      if (percentualPerda > 5) {
        resumo.alertas.push(
          `${item.medicamento.nome}: Perda de ${percentualPerda.toFixed(1)}% do estoque`
        );
      }
    }
  });
  
  return resumo;
}

// Gerar HTML do relatório BSPO
export function gerarRelatorioBalancoHTML(dados: DadosBalanco): string {
  const { estabelecimento, periodo, itens } = dados;
  const resumo = gerarResumoBalanco(dados);
  
  const periodoTexto = periodo.tipo === 'ANUAL' 
    ? `Anual - ${periodo.ano}`
    : `${periodo.trimestre}º Trimestre - ${periodo.ano}`;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>BSPO - ${periodoTexto}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 8pt; }
    .header { text-align: center; margin-bottom: 5mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }
    .header h1 { font-size: 14pt; margin-bottom: 2mm; }
    .header h2 { font-size: 10pt; font-weight: normal; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 5mm; }
    .info-box { border: 1px solid #ccc; padding: 2mm; }
    .info-box strong { display: block; margin-bottom: 1mm; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
    th, td { border: 1px solid #000; padding: 1.5mm; text-align: center; }
    th { background: #e0e0e0; font-weight: bold; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .subtotal { background: #f5f5f5; font-weight: bold; }
    .total { background: #d0d0d0; font-weight: bold; }
    .lista-header { background: #333; color: white; }
    .alerta { color: #c00; font-weight: bold; }
    .footer { margin-top: 10mm; }
    .assinatura { display: inline-block; width: 45%; text-align: center; margin-top: 15mm; }
    .assinatura-linha { border-top: 1px solid #000; padding-top: 2mm; }
    .resumo { margin-top: 5mm; padding: 3mm; border: 1px solid #000; }
    .resumo h3 { margin-bottom: 2mm; }
  </style>
</head>
<body>
  <div class="header">
    <h1>BALANÇO DE SUBSTÂNCIAS PSICOATIVAS E OUTRAS - BSPO</h1>
    <h2>Portaria SVS/MS nº 344/98 - RDC nº 22/2014</h2>
  </div>
  
  <div class="info-grid">
    <div class="info-box">
      <strong>Estabelecimento</strong>
      ${estabelecimento.razaoSocial}<br>
      CNPJ: ${estabelecimento.cnpj}<br>
      Autorização ANVISA: ${estabelecimento.autorizacaoAnvisa}
    </div>
    <div class="info-box">
      <strong>Período</strong>
      ${periodoTexto}<br>
      De ${new Date(periodo.dataInicio).toLocaleDateString('pt-BR')} 
      a ${new Date(periodo.dataFim).toLocaleDateString('pt-BR')}<br>
      Responsável Técnico: ${estabelecimento.responsavelTecnico} - CRF ${estabelecimento.crf}
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width: 15%">Medicamento</th>
        <th rowspan="2" style="width: 5%">Lista</th>
        <th rowspan="2" style="width: 6%">Estoque Inicial</th>
        <th colspan="4" style="width: 24%">ENTRADAS</th>
        <th colspan="5" style="width: 30%">SAÍDAS</th>
        <th rowspan="2" style="width: 6%">Estoque Final</th>
        <th rowspan="2" style="width: 6%">Diferença</th>
      </tr>
      <tr>
        <th>Compras</th>
        <th>Transf.</th>
        <th>Devol.</th>
        <th>Total</th>
        <th>Vendas</th>
        <th>Transf.</th>
        <th>Perdas</th>
        <th>Venc.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${gerarLinhasTabela(itens)}
    </tbody>
  </table>
  
  <div class="resumo">
    <h3>RESUMO POR LISTA</h3>
    <table>
      <thead>
        <tr>
          <th>Lista</th>
          <th>Qtd. Itens</th>
          <th>Estoque Inicial</th>
          <th>Total Entradas</th>
          <th>Total Saídas</th>
          <th>Estoque Final</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(resumo.porLista).map(([lista, dados]) => `
          <tr>
            <td><strong>${lista}</strong></td>
            <td>${dados.itens}</td>
            <td>${dados.estoqueInicial}</td>
            <td>${dados.entradas}</td>
            <td>${dados.saidas}</td>
            <td>${dados.estoqueFinal}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${resumo.alertas.length > 0 ? `
      <div style="margin-top: 3mm; color: #c00;">
        <strong>ALERTAS:</strong>
        <ul>
          ${resumo.alertas.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
  
  <div class="footer">
    <p style="font-size: 7pt; margin-bottom: 5mm;">
      Declaro, sob as penas da lei, que as informações prestadas neste documento são verdadeiras 
      e que o estoque físico confere com o estoque escritural.
    </p>
    
    <div class="assinatura">
      <div class="assinatura-linha">
        ${estabelecimento.responsavelTecnico}<br>
        CRF ${estabelecimento.crf}<br>
        Responsável Técnico
      </div>
    </div>
    
    <div class="assinatura">
      <div class="assinatura-linha">
        Local e Data<br>
        ____/____/________
      </div>
    </div>
  </div>
</body>
</html>`;
}

function gerarLinhasTabela(itens: ItemBalanco[]): string {
  // Agrupar por lista
  const porLista: Record<string, ItemBalanco[]> = {};
  itens.forEach((item) => {
    const lista = item.medicamento.lista;
    if (!porLista[lista]) porLista[lista] = [];
    porLista[lista].push(item);
  });
  
  let html = '';
  
  Object.entries(porLista).sort().forEach(([lista, items]) => {
    // Header da lista
    html += `
      <tr class="lista-header">
        <td colspan="14">LISTA ${lista}</td>
      </tr>`;
    
    // Itens
    items.forEach((item) => {
      const diferenca = item.diferencaInventario;
      html += `
        <tr>
          <td class="text-left">${item.medicamento.nome}</td>
          <td>${item.medicamento.lista}</td>
          <td>${item.estoqueInicial}</td>
          <td>${item.entradas.compras}</td>
          <td>${item.entradas.transferencias}</td>
          <td>${item.entradas.devolucoes}</td>
          <td><strong>${item.entradas.total}</strong></td>
          <td>${item.saidas.vendas}</td>
          <td>${item.saidas.transferencias}</td>
          <td>${item.saidas.perdas > 0 ? `<span class="alerta">${item.saidas.perdas}</span>` : '0'}</td>
          <td>${item.saidas.vencimentos}</td>
          <td><strong>${item.saidas.total}</strong></td>
          <td><strong>${item.estoqueFinal}</strong></td>
          <td class="${diferenca !== 0 ? 'alerta' : ''}">${diferenca}</td>
        </tr>`;
    });
    
    // Subtotal da lista
    const subtotal = items.reduce((acc, item) => ({
      estoqueInicial: acc.estoqueInicial + item.estoqueInicial,
      entradas: acc.entradas + item.entradas.total,
      saidas: acc.saidas + item.saidas.total,
      estoqueFinal: acc.estoqueFinal + item.estoqueFinal,
    }), { estoqueInicial: 0, entradas: 0, saidas: 0, estoqueFinal: 0 });
    
    html += `
      <tr class="subtotal">
        <td class="text-right" colspan="2">Subtotal Lista ${lista}</td>
        <td>${subtotal.estoqueInicial}</td>
        <td colspan="3"></td>
        <td>${subtotal.entradas}</td>
        <td colspan="4"></td>
        <td>${subtotal.saidas}</td>
        <td>${subtotal.estoqueFinal}</td>
        <td></td>
      </tr>`;
  });
  
  return html;
}

// Gerar CSV do balanço para exportação
export function gerarBalancoCSV(dados: DadosBalanco): string {
  const headers = [
    'Código',
    'Medicamento',
    'Lista',
    'Unidade',
    'Estoque Inicial',
    'Compras',
    'Transferências Entrada',
    'Devoluções',
    'Total Entradas',
    'Vendas',
    'Transferências Saída',
    'Perdas',
    'Vencimentos',
    'Apreensões',
    'Total Saídas',
    'Estoque Final',
    'Diferença',
    'Observações',
  ];
  
  const rows = dados.itens.map((item) => [
    item.medicamento.codigo,
    `"${item.medicamento.nome}"`,
    item.medicamento.lista,
    item.medicamento.unidade,
    item.estoqueInicial,
    item.entradas.compras,
    item.entradas.transferencias,
    item.entradas.devolucoes,
    item.entradas.total,
    item.saidas.vendas,
    item.saidas.transferencias,
    item.saidas.perdas,
    item.saidas.vencimentos,
    item.saidas.apreensoes,
    item.saidas.total,
    item.estoqueFinal,
    item.diferencaInventario,
    `"${item.observacoes || ''}"`,
  ]);
  
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

// Validar balanço antes de enviar
export function validarBalanco(dados: DadosBalanco): {
  valido: boolean;
  erros: string[];
  avisos: string[];
} {
  const erros: string[] = [];
  const avisos: string[] = [];
  
  // Validar estabelecimento
  if (!dados.estabelecimento.autorizacaoAnvisa) {
    erros.push('Autorização ANVISA não informada');
  }
  
  // Validar itens
  dados.itens.forEach((item, index) => {
    const prefixo = `Item ${index + 1} (${item.medicamento.nome}):`;
    
    // Verificar cálculo
    const calculado = item.estoqueInicial + item.entradas.total - item.saidas.total;
    if (calculado !== item.estoqueFinal) {
      erros.push(`${prefixo} Estoque final não confere (esperado: ${calculado}, informado: ${item.estoqueFinal})`);
    }
    
    // Verificar valores negativos
    if (item.estoqueInicial < 0 || item.estoqueFinal < 0) {
      erros.push(`${prefixo} Estoque não pode ser negativo`);
    }
    
    // Verificar perdas
    if (item.saidas.perdas > 0 && !item.observacoes) {
      avisos.push(`${prefixo} Perda registrada sem observação/justificativa`);
    }
    
    // Verificar diferença de inventário
    if (item.diferencaInventario !== 0) {
      avisos.push(`${prefixo} Diferença de inventário de ${item.diferencaInventario} unidades`);
    }
  });
  
  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

// Calcular prazo de entrega do balanço
export function calcularPrazoEntrega(
  tipo: 'TRIMESTRAL' | 'ANUAL',
  ano: number,
  trimestre?: 1 | 2 | 3 | 4
): { prazo: string; diasRestantes: number } {
  const hoje = new Date();
  let prazo: Date;
  
  if (tipo === 'ANUAL') {
    // Balanço anual: até 31 de janeiro do ano seguinte
    prazo = new Date(ano + 1, 0, 31);
  } else {
    // Balanço trimestral: até 15 dias após o fim do trimestre
    const fimTrimestre = {
      1: new Date(ano, 3, 15), // 15 de abril
      2: new Date(ano, 6, 15), // 15 de julho
      3: new Date(ano, 9, 15), // 15 de outubro
      4: new Date(ano + 1, 0, 15), // 15 de janeiro
    };
    prazo = fimTrimestre[trimestre || 1];
  }
  
  const diasRestantes = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    prazo: prazo.toISOString().split('T')[0],
    diasRestantes: Math.max(0, diasRestantes),
  };
}
