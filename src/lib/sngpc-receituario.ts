// SNGPC - Receituário Especial (Amarelo e Azul)
// Conforme Portaria 344/98 e RDC 58/2007

import { TipoReceituario, ListaControlada, MedicamentoControlado } from './sngpc-index';

export interface DadosPrescricao {
  medicamento: MedicamentoControlado;
  quantidade: number;
  posologia: string;
  duracao: number;
  unidade: 'comprimido' | 'cápsula' | 'ampola' | 'frasco' | 'adesivo' | 'outro';
  viaAdministracao: string;
}

export interface DadosPaciente {
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone?: string;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  sexo?: 'M' | 'F';
  idade?: number;
}

export interface DadosPrescriptor {
  nome: string;
  crm: string;
  uf: string;
  especialidade?: string;
  endereco: string;
  cidade: string;
  telefone?: string;
}

export interface DadosClinica {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  autorizacaoAnvisa?: string;
}

export interface NotificacaoReceita {
  numero: string;
  serie: string;
  tipo: TipoReceituario;
  data: string;
  paciente: DadosPaciente;
  prescricao: DadosPrescricao;
  prescriptor: DadosPrescriptor;
  clinica: DadosClinica;
  compradorNome?: string;
  compradorRg?: string;
  compradorEndereco?: string;
  compradorTelefone?: string;
  dataDispensacao?: string;
}

// Gerar número sequencial de notificação
export function gerarNumeroNotificacao(
  tipo: TipoReceituario,
  sequencial: number,
  ano: number
): { numero: string; serie: string } {
  const prefixo = tipo === 'AMARELA' ? 'A' : tipo === 'AZUL' ? 'B' : 'C';
  const numero = sequencial.toString().padStart(6, '0');
  const serie = `${prefixo}${ano}`;
  return { numero, serie };
}

// Validar se receita está dentro da validade
export function validarValidadeReceita(dataEmissao: string, lista: ListaControlada): {
  valida: boolean;
  diasRestantes: number;
  dataVencimento: string;
} {
  const emissao = new Date(dataEmissao);
  const hoje = new Date();
  const validadeDias = 30;
  
  const vencimento = new Date(emissao);
  vencimento.setDate(vencimento.getDate() + validadeDias);
  
  const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    valida: diasRestantes > 0,
    diasRestantes: Math.max(0, diasRestantes),
    dataVencimento: vencimento.toISOString().split('T')[0],
  };
}

// Calcular idade a partir da data de nascimento
function calcularIdade(dataNascimento?: string): number | null {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth();
  const mesNascimento = nascimento.getMonth();
  if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Formatar sexo para exibição
function formatarSexo(sexo?: 'M' | 'F'): string {
  if (!sexo) return 'N/I';
  return sexo === 'M' ? 'Masculino' : 'Feminino';
}

// Gerar linha de idade/sexo para receituários (Portaria 344/98 Art. 38)
function gerarLinhaIdadeSexo(paciente: DadosPaciente): string {
  const idade = paciente.idade ?? calcularIdade(paciente.dataNascimento);
  const sexo = formatarSexo(paciente.sexo);
  return `<span class="campo-label">Idade:</span> ${idade ?? 'N/I'} anos | <span class="campo-label">Sexo:</span> ${sexo}`;
}

// Gerar HTML do receituário amarelo (A1, A2, A3)
export function gerarReceitaAmarelaHTML(notificacao: NotificacaoReceita): string {
  const { paciente, prescricao, prescriptor, clinica } = notificacao;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Notificação de Receita A - ${notificacao.numero}</title>
  <style>
    @page { size: A5 landscape; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 9pt;
      background: #FFFF99;
      padding: 5mm;
    }
    .container {
      border: 2px solid #000;
      padding: 3mm;
      height: 100%;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .header-left { flex: 1; }
    .header-right { 
      text-align: right;
      font-weight: bold;
    }
    .titulo {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin: 2mm 0;
      text-transform: uppercase;
    }
    .subtitulo {
      font-size: 8pt;
      text-align: center;
      margin-bottom: 2mm;
    }
    .campo {
      margin: 1.5mm 0;
      display: flex;
    }
    .campo-label {
      font-weight: bold;
      min-width: 80px;
    }
    .campo-valor {
      flex: 1;
      border-bottom: 1px dotted #000;
      padding-left: 2mm;
    }
    .prescricao {
      border: 1px solid #000;
      padding: 2mm;
      margin: 2mm 0;
      min-height: 40mm;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px solid #000;
    }
    .assinatura {
      text-align: center;
      width: 45%;
    }
    .assinatura-linha {
      border-top: 1px solid #000;
      margin-top: 10mm;
      padding-top: 1mm;
    }
    .numero-receita {
      font-size: 12pt;
      font-weight: bold;
      color: #000;
    }
    .aviso {
      font-size: 7pt;
      text-align: center;
      margin-top: 2mm;
      font-style: italic;
    }
    .lista-info {
      background: #FFD700;
      padding: 1mm 2mm;
      font-weight: bold;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <strong>${clinica.nome}</strong><br>
        ${clinica.endereco}<br>
        ${clinica.cidade} - ${clinica.uf}<br>
        Tel: ${clinica.telefone}<br>
        CNPJ: ${clinica.cnpj}
      </div>
      <div class="header-right">
        <span class="numero-receita">Nº ${notificacao.numero}</span><br>
        Série: ${notificacao.serie}<br>
        <span class="lista-info">LISTA ${prescricao.medicamento.lista}</span>
      </div>
    </div>
    
    <div class="titulo">NOTIFICAÇÃO DE RECEITA "A"</div>
    <div class="subtitulo">Portaria SVS/MS nº 344/98 - Substâncias Entorpecentes e Psicotrópicas</div>
    
    <div class="campo">
      <span class="campo-label">Paciente:</span>
      <span class="campo-valor">${paciente.nome}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">${paciente.endereco} - ${paciente.cidade}/${paciente.uf}</span>
    </div>
    <div class="campo">
      ${gerarLinhaIdadeSexo(paciente)}
    </div>
    
    <div class="prescricao">
      <strong>PRESCRIÇÃO:</strong><br><br>
      <strong>${prescricao.medicamento.nome}</strong>
      ${prescricao.medicamento.concentracoes ? ` - ${prescricao.medicamento.concentracoes[0]}` : ''}<br>
      Quantidade: ${prescricao.quantidade} ${prescricao.unidade}(s)<br>
      Posologia: ${prescricao.posologia}<br>
      Via: ${prescricao.viaAdministracao}<br>
      Duração do tratamento: ${prescricao.duracao} dias
    </div>
    
    <div class="campo">
      <span class="campo-label">Data:</span>
      <span class="campo-valor">${new Date(notificacao.data).toLocaleDateString('pt-BR')}</span>
    </div>
    
    <div class="footer">
      <div class="assinatura">
        <div class="assinatura-linha">
          ${prescriptor.nome}<br>
          CRM ${prescriptor.crm}/${prescriptor.uf}
        </div>
      </div>
      <div class="assinatura">
        <div class="assinatura-linha">
          Identificação do Comprador<br>
          (Nome, RG, Endereço, Telefone)
        </div>
      </div>
    </div>
    
    <div class="aviso">
      ATENÇÃO: A NOTIFICAÇÃO DE RECEITA É DOCUMENTO INDISPENSÁVEL PARA DISPENSAÇÃO.<br>
      VÁLIDA POR 30 DIAS A CONTAR DA DATA DE EMISSÃO, EM TODO O TERRITÓRIO NACIONAL.
    </div>
  </div>
</body>
</html>`;
}

// Gerar HTML do receituário azul (B1, B2)
export function gerarReceitaAzulHTML(notificacao: NotificacaoReceita): string {
  const { paciente, prescricao, prescriptor, clinica } = notificacao;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Notificação de Receita B - ${notificacao.numero}</title>
  <style>
    @page { size: A5 landscape; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 9pt;
      background: #ADD8E6;
      padding: 5mm;
    }
    .container {
      border: 2px solid #000;
      padding: 3mm;
      height: 100%;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .header-left { flex: 1; }
    .header-right { 
      text-align: right;
      font-weight: bold;
    }
    .titulo {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin: 2mm 0;
      text-transform: uppercase;
    }
    .subtitulo {
      font-size: 8pt;
      text-align: center;
      margin-bottom: 2mm;
    }
    .campo {
      margin: 1.5mm 0;
      display: flex;
    }
    .campo-label {
      font-weight: bold;
      min-width: 80px;
    }
    .campo-valor {
      flex: 1;
      border-bottom: 1px dotted #000;
      padding-left: 2mm;
    }
    .prescricao {
      border: 1px solid #000;
      padding: 2mm;
      margin: 2mm 0;
      min-height: 40mm;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px solid #000;
    }
    .assinatura {
      text-align: center;
      width: 45%;
    }
    .assinatura-linha {
      border-top: 1px solid #000;
      margin-top: 10mm;
      padding-top: 1mm;
    }
    .numero-receita {
      font-size: 12pt;
      font-weight: bold;
      color: #000;
    }
    .aviso {
      font-size: 7pt;
      text-align: center;
      margin-top: 2mm;
      font-style: italic;
    }
    .lista-info {
      background: #4169E1;
      color: white;
      padding: 1mm 2mm;
      font-weight: bold;
      display: inline-block;
    }
    .tipo-b2 {
      background: #FF6347;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <strong>${clinica.nome}</strong><br>
        ${clinica.endereco}<br>
        ${clinica.cidade} - ${clinica.uf}<br>
        Tel: ${clinica.telefone}<br>
        CNPJ: ${clinica.cnpj}
      </div>
      <div class="header-right">
        <span class="numero-receita">Nº ${notificacao.numero}</span><br>
        Série: ${notificacao.serie}<br>
        <span class="lista-info ${prescricao.medicamento.lista === 'B2' ? 'tipo-b2' : ''}">
          LISTA ${prescricao.medicamento.lista}
          ${prescricao.medicamento.lista === 'B2' ? ' (ANOREXÍGENO)' : ''}
        </span>
      </div>
    </div>
    
    <div class="titulo">NOTIFICAÇÃO DE RECEITA "B"</div>
    <div class="subtitulo">
      Portaria SVS/MS nº 344/98 - Substâncias Psicotrópicas
      ${prescricao.medicamento.lista === 'B2' ? ' (Anorexígenos - RDC 52/2011)' : ''}
    </div>
    
    <div class="campo">
      <span class="campo-label">Paciente:</span>
      <span class="campo-valor">${paciente.nome}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">${paciente.endereco} - ${paciente.cidade}/${paciente.uf}</span>
    </div>
    <div class="campo">
      ${gerarLinhaIdadeSexo(paciente)}
    </div>
    
    <div class="prescricao">
      <strong>PRESCRIÇÃO:</strong><br><br>
      <strong>${prescricao.medicamento.nome}</strong>
      ${prescricao.medicamento.concentracoes ? ` - ${prescricao.medicamento.concentracoes[0]}` : ''}<br>
      Quantidade: ${prescricao.quantidade} ${prescricao.unidade}(s)<br>
      Posologia: ${prescricao.posologia}<br>
      Via: ${prescricao.viaAdministracao}<br>
      Duração do tratamento: ${prescricao.duracao} dias
    </div>
    
    <div class="campo">
      <span class="campo-label">Data:</span>
      <span class="campo-valor">${new Date(notificacao.data).toLocaleDateString('pt-BR')}</span>
    </div>
    
    <div class="footer">
      <div class="assinatura">
        <div class="assinatura-linha">
          ${prescriptor.nome}<br>
          CRM ${prescriptor.crm}/${prescriptor.uf}
        </div>
      </div>
      <div class="assinatura">
        <div class="assinatura-linha">
          Identificação do Comprador<br>
          (Nome, RG, Endereço, Telefone)
        </div>
      </div>
    </div>
    
    <div class="aviso">
      ATENÇÃO: A NOTIFICAÇÃO DE RECEITA É DOCUMENTO INDISPENSÁVEL PARA DISPENSAÇÃO.<br>
      VÁLIDA POR 30 DIAS A CONTAR DA DATA DE EMISSÃO, EM TODO O TERRITÓRIO NACIONAL.<br>
      ${prescricao.medicamento.lista === 'B1' ? 'QUANTIDADE MÁXIMA: 60 DIAS DE TRATAMENTO.' : 'QUANTIDADE MÁXIMA: 30 DIAS DE TRATAMENTO.'}
    </div>
  </div>
</body>
</html>`;
}

// Gerar HTML da receita de controle especial (C1-C5) - Branca 2 vias
export function gerarReceitaControleEspecialHTML(notificacao: NotificacaoReceita): string {
  const { paciente, prescricao, prescriptor, clinica } = notificacao;
  
  const listaNomes: Record<string, string> = {
    C1: 'Outras Substâncias Sujeitas a Controle Especial',
    C2: 'Retinoides de Uso Sistêmico',
    C3: 'Imunossupressores (Talidomida)',
    C4: 'Anti-retrovirais',
    C5: 'Anabolizantes',
  };
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receita de Controle Especial - ${notificacao.numero}</title>
  <style>
    @page { size: A5 portrait; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 9pt;
      background: #FFFFFF;
      padding: 5mm;
    }
    .container {
      border: 2px solid #000;
      padding: 3mm;
      height: 100%;
    }
    .via-info {
      text-align: right;
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    .header {
      border-bottom: 1px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
      text-align: center;
    }
    .titulo {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin: 2mm 0;
      text-transform: uppercase;
      background: #E0E0E0;
      padding: 2mm;
    }
    .subtitulo {
      font-size: 8pt;
      text-align: center;
      margin-bottom: 2mm;
    }
    .campo {
      margin: 2mm 0;
    }
    .campo-label {
      font-weight: bold;
    }
    .campo-valor {
      border-bottom: 1px dotted #000;
      display: inline-block;
      min-width: 200px;
      padding-left: 2mm;
    }
    .prescricao {
      border: 1px solid #000;
      padding: 3mm;
      margin: 3mm 0;
      min-height: 60mm;
    }
    .footer {
      margin-top: 5mm;
      padding-top: 2mm;
      border-top: 1px solid #000;
    }
    .assinatura {
      text-align: center;
      margin-top: 15mm;
    }
    .assinatura-linha {
      border-top: 1px solid #000;
      width: 60%;
      margin: 0 auto;
      padding-top: 1mm;
    }
    .numero-receita {
      font-size: 10pt;
      font-weight: bold;
    }
    .aviso {
      font-size: 7pt;
      text-align: center;
      margin-top: 3mm;
      font-style: italic;
      border: 1px dashed #000;
      padding: 2mm;
    }
    .lista-info {
      background: #333;
      color: white;
      padding: 1mm 3mm;
      font-weight: bold;
      display: inline-block;
      margin: 2mm 0;
    }
    .clinica-info {
      font-size: 8pt;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="via-info">1ª VIA - FARMÁCIA</div>
    
    <div class="header">
      <strong>${clinica.nome}</strong><br>
      <span class="clinica-info">
        ${clinica.endereco} - ${clinica.cidade}/${clinica.uf}<br>
        Tel: ${clinica.telefone} | CNPJ: ${clinica.cnpj}
      </span>
    </div>
    
    <div class="titulo">RECEITA DE CONTROLE ESPECIAL</div>
    <div class="subtitulo">
      <span class="lista-info">LISTA ${prescricao.medicamento.lista}</span><br>
      ${listaNomes[prescricao.medicamento.lista] || 'Substância Controlada'}
    </div>
    
    <div class="campo">
      <span class="campo-label">Nº:</span>
      <span class="numero-receita">${notificacao.numero}</span> |
      <span class="campo-label">Série:</span> ${notificacao.serie} |
      <span class="campo-label">Data:</span> ${new Date(notificacao.data).toLocaleDateString('pt-BR')}
    </div>
    
    <div class="campo">
      <span class="campo-label">Paciente:</span>
      <span class="campo-valor">${paciente.nome}</span>
    </div>
    <div class="campo">
      <span class="campo-label">Endereço:</span>
      <span class="campo-valor">${paciente.endereco} - ${paciente.cidade}/${paciente.uf}</span>
    </div>
    <div class="campo">
      ${gerarLinhaIdadeSexo(paciente)}
    </div>
    
    <div class="prescricao">
      <strong>PRESCRIÇÃO:</strong><br><br>
      <strong>${prescricao.medicamento.nome}</strong>
      ${prescricao.medicamento.concentracoes ? ` - ${prescricao.medicamento.concentracoes[0]}` : ''}<br><br>
      <strong>Quantidade:</strong> ${prescricao.quantidade} ${prescricao.unidade}(s)<br>
      <strong>Posologia:</strong> ${prescricao.posologia}<br>
      <strong>Via de administração:</strong> ${prescricao.viaAdministracao}<br>
      <strong>Duração do tratamento:</strong> ${prescricao.duracao} dias
    </div>
    
    <div class="footer">
      <div class="assinatura">
        <div class="assinatura-linha">
          ${prescriptor.nome}<br>
          CRM ${prescriptor.crm}/${prescriptor.uf}
          ${prescriptor.especialidade ? `<br>${prescriptor.especialidade}` : ''}
        </div>
      </div>
    </div>
    
    <div class="aviso">
      RECEITA DE CONTROLE ESPECIAL - VÁLIDA POR 30 DIAS<br>
      1ª VIA: RETIDA NA FARMÁCIA | 2ª VIA: DEVOLVIDA AO PACIENTE<br>
      ${prescricao.medicamento.lista === 'C2' ? 'ATENÇÃO: RETINOIDE - VERIFICAR TERMO DE CONSENTIMENTO' : ''}
      ${prescricao.medicamento.lista === 'C3' ? 'ATENÇÃO: TALIDOMIDA - USO RESTRITO A PROGRAMAS DO MS' : ''}
      ${prescricao.medicamento.lista === 'C5' ? 'ATENÇÃO: ANABOLIZANTE - VERIFICAR INDICAÇÃO TERAPÊUTICA' : ''}
    </div>
  </div>
</body>
</html>`;
}

// Função principal para gerar receita baseada no tipo de medicamento
export function gerarReceitaHTML(notificacao: NotificacaoReceita): string {
  const lista = notificacao.prescricao.medicamento.lista;
  
  if (['A1', 'A2', 'A3'].includes(lista)) {
    return gerarReceitaAmarelaHTML(notificacao);
  } else if (['B1', 'B2'].includes(lista)) {
    return gerarReceitaAzulHTML(notificacao);
  } else {
    return gerarReceitaControleEspecialHTML(notificacao);
  }
}

// Gerar segunda via (para receitas C1-C5)
export function gerarSegundaViaHTML(notificacao: NotificacaoReceita): string {
  const html = gerarReceitaControleEspecialHTML(notificacao);
  return html.replace('1ª VIA - FARMÁCIA', '2ª VIA - PACIENTE')
             .replace('1ª VIA: RETIDA NA FARMÁCIA | 2ª VIA: DEVOLVIDA AO PACIENTE', 
                      'ESTA É A 2ª VIA - GUARDAR PARA CONTROLE');
}
