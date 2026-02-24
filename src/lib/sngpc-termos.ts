// SNGPC - Termos Obrigatórios ANVISA
// Termos de Responsabilidade e Consentimento

export interface DadosPacienteTermo {
  nome: string;
  cpf: string;
  dataNascimento: string;
  idade: number;
  sexo: 'M' | 'F';
  endereco: string;
  cidade: string;
  uf: string;
  telefone?: string;
}

export interface DadosPrescritorTermo {
  nome: string;
  crm: string;
  uf: string;
  especialidade?: string;
}

export interface DadosClinicaTermo {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
}

// Termo de Responsabilidade do Prescritor - SIBUTRAMINA (RDC 52/2011)
export function gerarTermoSibutraminaHTML(
  paciente: DadosPacienteTermo,
  prescritor: DadosPrescritorTermo,
  clinica: DadosClinicaTermo,
  dataEmissao: string = new Date().toISOString()
): string {
  const dataFormatada = new Date(dataEmissao).toLocaleDateString('pt-BR');
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Responsabilidade - Sibutramina</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .titulo { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
    .subtitulo { font-size: 10pt; color: #666; }
    .secao { margin: 15px 0; }
    .secao-titulo { font-weight: bold; background: #f0f0f0; padding: 5px 10px; margin-bottom: 10px; }
    .campo { margin: 8px 0; }
    .campo-label { font-weight: bold; }
    .checkbox { margin: 5px 0; padding-left: 25px; position: relative; }
    .checkbox::before { content: "☐"; position: absolute; left: 0; }
    .assinatura { margin-top: 40px; display: flex; justify-content: space-between; }
    .assinatura-box { width: 45%; text-align: center; }
    .assinatura-linha { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }
    .aviso { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; font-size: 10pt; }
    .obrigatorio { color: #c00; font-weight: bold; }
    .vias { font-size: 9pt; color: #666; text-align: center; margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-weight: bold;">${clinica.nome}</div>
    <div style="font-size: 9pt;">${clinica.endereco} - ${clinica.cidade}/${clinica.uf}</div>
    <div style="font-size: 9pt;">CNPJ: ${clinica.cnpj} | Tel: ${clinica.telefone}</div>
    <div class="titulo">Termo de Responsabilidade do Prescritor</div>
    <div class="subtitulo">SIBUTRAMINA - RDC nº 52/2011 ANVISA</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">1. IDENTIFICAÇÃO DO PACIENTE</div>
    <div class="campo"><span class="campo-label">Nome:</span> ${paciente.nome}</div>
    <div class="campo"><span class="campo-label">CPF:</span> ${paciente.cpf}</div>
    <div class="campo"><span class="campo-label">Data de Nascimento:</span> ${new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')} | <span class="campo-label">Idade:</span> ${paciente.idade} anos | <span class="campo-label">Sexo:</span> ${paciente.sexo === 'M' ? 'Masculino' : 'Feminino'}</div>
    <div class="campo"><span class="campo-label">Endereço:</span> ${paciente.endereco} - ${paciente.cidade}/${paciente.uf}</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">2. IDENTIFICAÇÃO DO PRESCRITOR</div>
    <div class="campo"><span class="campo-label">Nome:</span> ${prescritor.nome}</div>
    <div class="campo"><span class="campo-label">CRM:</span> ${prescritor.crm}/${prescritor.uf} ${prescritor.especialidade ? `| <span class="campo-label">Especialidade:</span> ${prescritor.especialidade}` : ''}</div>
  </div>

  <div class="aviso">
    <strong>⚠️ ATENÇÃO - CONTRAINDICAÇÕES ABSOLUTAS:</strong><br>
    A sibutramina é <span class="obrigatorio">CONTRAINDICADA</span> para pacientes com:
    <ul style="margin: 5px 0;">
      <li>Histórico de doença cardiovascular (infarto, AVC, insuficiência cardíaca)</li>
      <li>Hipertensão arterial não controlada</li>
      <li>Arritmias cardíacas</li>
      <li>Doença arterial coronariana</li>
      <li>Idade superior a 65 anos</li>
      <li>Uso concomitante de IMAO ou outros anorexígenos</li>
    </ul>
  </div>

  <div class="secao">
    <div class="secao-titulo">3. DECLARAÇÃO DO PRESCRITOR</div>
    <p>Eu, <strong>${prescritor.nome}</strong>, CRM ${prescritor.crm}/${prescritor.uf}, declaro que:</p>
    <div class="checkbox">Avaliei o paciente e verifiquei que NÃO apresenta contraindicações ao uso de sibutramina;</div>
    <div class="checkbox">Informei ao paciente sobre os riscos cardiovasculares associados ao uso do medicamento;</div>
    <div class="checkbox">Orientei sobre a necessidade de monitoramento regular da pressão arterial e frequência cardíaca;</div>
    <div class="checkbox">O IMC do paciente é ≥ 30 kg/m² OU ≥ 25 kg/m² com comorbidades;</div>
    <div class="checkbox">O tratamento será acompanhado de dieta hipocalórica e atividade física;</div>
    <div class="checkbox">Comprometo-me a suspender o tratamento caso não haja perda de pelo menos 5% do peso em 12 semanas.</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">4. DECLARAÇÃO DO PACIENTE</div>
    <p>Eu, <strong>${paciente.nome}</strong>, declaro que:</p>
    <div class="checkbox">Fui informado(a) sobre os riscos cardiovasculares da sibutramina;</div>
    <div class="checkbox">Não possuo histórico de doenças cardiovasculares;</div>
    <div class="checkbox">Comprometo-me a informar imediatamente ao médico caso apresente palpitações, dor no peito ou falta de ar;</div>
    <div class="checkbox">Estou ciente de que devo realizar acompanhamento médico regular durante o tratamento.</div>
  </div>

  <div class="assinatura">
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${prescritor.nome}<br>
        CRM ${prescritor.crm}/${prescritor.uf}<br>
        Prescritor
      </div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${paciente.nome}<br>
        CPF: ${paciente.cpf}<br>
        Paciente
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-top: 20px;">
    <strong>Data:</strong> ${dataFormatada}
  </div>

  <div class="vias">
    <strong>DOCUMENTO EM 3 VIAS:</strong> 1ª via - Prontuário | 2ª via - Farmácia | 3ª via - Paciente
  </div>
</body>
</html>`;
}

// Termo de Consentimento para RETINOIDES (C2) - Isotretinoína/Acitretina
export function gerarTermoRetinoidesHTML(
  paciente: DadosPacienteTermo,
  prescritor: DadosPrescritorTermo,
  clinica: DadosClinicaTermo,
  medicamento: string,
  dataTesteGravidez?: string,
  dataEmissao: string = new Date().toISOString()
): string {
  const dataFormatada = new Date(dataEmissao).toLocaleDateString('pt-BR');
  const isMulher = paciente.sexo === 'F';
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Consentimento - Retinoides</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .titulo { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
    .subtitulo { font-size: 10pt; color: #666; }
    .secao { margin: 12px 0; }
    .secao-titulo { font-weight: bold; background: #f0f0f0; padding: 5px 10px; margin-bottom: 8px; }
    .campo { margin: 6px 0; }
    .campo-label { font-weight: bold; }
    .checkbox { margin: 4px 0; padding-left: 20px; position: relative; font-size: 9pt; }
    .checkbox::before { content: "☐"; position: absolute; left: 0; }
    .assinatura { margin-top: 30px; display: flex; justify-content: space-between; }
    .assinatura-box { width: 45%; text-align: center; }
    .assinatura-linha { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 9pt; }
    .aviso-grave { background: #f8d7da; border: 2px solid #c00; padding: 10px; margin: 10px 0; }
    .obrigatorio { color: #c00; font-weight: bold; }
    .vias { font-size: 8pt; color: #666; text-align: center; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-weight: bold;">${clinica.nome}</div>
    <div style="font-size: 9pt;">${clinica.endereco} - ${clinica.cidade}/${clinica.uf} | CNPJ: ${clinica.cnpj}</div>
    <div class="titulo">Termo de Consentimento Informado</div>
    <div class="subtitulo">RETINOIDES DE USO SISTÊMICO - ${medicamento.toUpperCase()}</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">1. IDENTIFICAÇÃO</div>
    <div class="campo"><span class="campo-label">Paciente:</span> ${paciente.nome} | <span class="campo-label">CPF:</span> ${paciente.cpf}</div>
    <div class="campo"><span class="campo-label">Nascimento:</span> ${new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')} | <span class="campo-label">Idade:</span> ${paciente.idade} anos | <span class="campo-label">Sexo:</span> ${paciente.sexo === 'M' ? 'Masculino' : 'Feminino'}</div>
    <div class="campo"><span class="campo-label">Prescritor:</span> ${prescritor.nome} - CRM ${prescritor.crm}/${prescritor.uf}</div>
  </div>

  <div class="aviso-grave">
    <strong>⚠️ ALERTA DE TERATOGENICIDADE</strong><br>
    <span class="obrigatorio">O ${medicamento} causa MALFORMAÇÕES FETAIS GRAVES.</span><br>
    É absolutamente contraindicado durante a gravidez e em mulheres que possam engravidar sem contracepção adequada.
  </div>

  <div class="secao">
    <div class="secao-titulo">2. INFORMAÇÕES SOBRE O MEDICAMENTO</div>
    <p>O <strong>${medicamento}</strong> é um retinoide (derivado da vitamina A) indicado para tratamento de acne grave ou outras condições dermatológicas. Principais efeitos adversos:</p>
    <ul style="font-size: 9pt; margin: 5px 0;">
      <li>Ressecamento de pele, lábios e mucosas</li>
      <li>Elevação de triglicerídeos e colesterol</li>
      <li>Alterações hepáticas (exames periódicos obrigatórios)</li>
      <li>Fotossensibilidade (evitar exposição solar)</li>
      <li>Alterações de humor (raro)</li>
      <li><strong class="obrigatorio">TERATOGENICIDADE: malformações graves no feto</strong></li>
    </ul>
  </div>

  ${isMulher ? `
  <div class="secao">
    <div class="secao-titulo">3. CONTRACEPÇÃO OBRIGATÓRIA (MULHERES)</div>
    <div class="aviso-grave">
      <strong>OBRIGATÓRIO para mulheres em idade fértil:</strong>
      <ul style="margin: 5px 0; font-size: 9pt;">
        <li>Teste de gravidez NEGATIVO antes de iniciar o tratamento</li>
        <li>Uso de DOIS métodos contraceptivos durante todo o tratamento</li>
        <li>Manter contracepção por 1 mês após término (isotretinoína) ou 3 anos (acitretina)</li>
        <li>Testes de gravidez mensais durante o tratamento</li>
      </ul>
    </div>
    <div class="campo"><span class="campo-label">Data do teste de gravidez:</span> ${dataTesteGravidez ? new Date(dataTesteGravidez).toLocaleDateString('pt-BR') : '___/___/______'} | <span class="campo-label">Resultado:</span> NEGATIVO</div>
    <div class="campo"><span class="campo-label">Método contraceptivo 1:</span> _______________________</div>
    <div class="campo"><span class="campo-label">Método contraceptivo 2:</span> _______________________</div>
  </div>
  ` : ''}

  <div class="secao">
    <div class="secao-titulo">${isMulher ? '4' : '3'}. DECLARAÇÃO DO PACIENTE</div>
    <p>Eu, <strong>${paciente.nome}</strong>, declaro que:</p>
    <div class="checkbox">Fui informado(a) sobre os riscos e benefícios do tratamento com ${medicamento};</div>
    <div class="checkbox">Compreendo que o medicamento pode causar efeitos adversos;</div>
    <div class="checkbox">Comprometo-me a realizar os exames laboratoriais solicitados;</div>
    <div class="checkbox">Não doarei sangue durante o tratamento e por 1 mês após;</div>
    ${isMulher ? `
    <div class="checkbox"><strong class="obrigatorio">Compreendo que NÃO POSSO ENGRAVIDAR durante o tratamento;</strong></div>
    <div class="checkbox">Utilizarei DOIS métodos contraceptivos eficazes;</div>
    <div class="checkbox">Realizarei testes de gravidez mensais;</div>
    <div class="checkbox">Estou ciente das graves malformações que podem ocorrer no feto;</div>
    ` : ''}
    <div class="checkbox">Tive oportunidade de esclarecer todas as minhas dúvidas;</div>
    <div class="checkbox">Consinto livremente com o tratamento proposto.</div>
  </div>

  <div class="assinatura">
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${prescritor.nome}<br>CRM ${prescritor.crm}/${prescritor.uf}
      </div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${paciente.nome}<br>CPF: ${paciente.cpf}
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-top: 15px;"><strong>Data:</strong> ${dataFormatada}</div>

  <div class="vias">
    <strong>DOCUMENTO EM 2 VIAS:</strong> 1ª via - Prontuário | 2ª via - Paciente
  </div>
</body>
</html>`;
}

// Termo de Consentimento para TALIDOMIDA (C3) - Programa MS
export function gerarTermoTalidomidaHTML(
  paciente: DadosPacienteTermo,
  prescritor: DadosPrescritorTermo,
  clinica: DadosClinicaTermo,
  indicacao: string,
  numeroCadastroMS?: string,
  dataTesteGravidez?: string,
  dataEmissao: string = new Date().toISOString()
): string {
  const dataFormatada = new Date(dataEmissao).toLocaleDateString('pt-BR');
  const isMulher = paciente.sexo === 'F';
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Consentimento - Talidomida</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.3; }
    .header { text-align: center; border-bottom: 3px solid #c00; padding-bottom: 8px; margin-bottom: 10px; }
    .titulo { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 8px 0; color: #c00; }
    .subtitulo { font-size: 9pt; }
    .secao { margin: 10px 0; }
    .secao-titulo { font-weight: bold; background: #f0f0f0; padding: 4px 8px; margin-bottom: 6px; font-size: 10pt; }
    .campo { margin: 4px 0; }
    .campo-label { font-weight: bold; }
    .checkbox { margin: 3px 0; padding-left: 18px; position: relative; font-size: 8pt; }
    .checkbox::before { content: "☐"; position: absolute; left: 0; }
    .assinatura { margin-top: 20px; display: flex; justify-content: space-between; }
    .assinatura-box { width: 30%; text-align: center; }
    .assinatura-linha { border-top: 1px solid #000; margin-top: 30px; padding-top: 3px; font-size: 8pt; }
    .aviso-critico { background: #c00; color: white; padding: 8px; margin: 8px 0; font-weight: bold; text-align: center; }
    .aviso-grave { background: #f8d7da; border: 2px solid #c00; padding: 8px; margin: 8px 0; font-size: 8pt; }
    .obrigatorio { color: #c00; font-weight: bold; }
    .vias { font-size: 7pt; color: #666; text-align: center; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 6px; }
    .ms-box { border: 2px solid #000; padding: 8px; margin: 8px 0; background: #fffde7; }
  </style>
</head>
<body>
  <div class="header">
    <div class="titulo">⚠️ TERMO DE ESCLARECIMENTO E RESPONSABILIDADE - TALIDOMIDA</div>
    <div class="subtitulo">Programa de Controle da Talidomida - Ministério da Saúde</div>
    <div style="font-size: 8pt; margin-top: 5px;">${clinica.nome} | CNPJ: ${clinica.cnpj}</div>
  </div>

  <div class="aviso-critico">
    ⚠️ TALIDOMIDA CAUSA DEFEITOS FÍSICOS GRAVES E IRREVERSÍVEIS NO FETO ⚠️
  </div>

  <div class="secao">
    <div class="secao-titulo">1. IDENTIFICAÇÃO</div>
    <div class="campo"><span class="campo-label">Paciente:</span> ${paciente.nome} | <span class="campo-label">CPF:</span> ${paciente.cpf} | <span class="campo-label">Sexo:</span> ${paciente.sexo === 'M' ? 'M' : 'F'} | <span class="campo-label">Idade:</span> ${paciente.idade} anos</div>
    <div class="campo"><span class="campo-label">Prescritor:</span> ${prescritor.nome} - CRM ${prescritor.crm}/${prescritor.uf}</div>
    <div class="campo"><span class="campo-label">Indicação:</span> ${indicacao}</div>
  </div>

  <div class="ms-box">
    <strong>PROGRAMA DO MINISTÉRIO DA SAÚDE</strong><br>
    <span class="campo-label">Nº Cadastro no Programa:</span> ${numeroCadastroMS || '________________________'}<br>
    <span style="font-size: 8pt;">A talidomida só pode ser dispensada mediante cadastro no programa oficial do MS.</span>
  </div>

  <div class="secao">
    <div class="secao-titulo">2. INDICAÇÕES APROVADAS</div>
    <ul style="font-size: 8pt; margin: 3px 0;">
      <li>Hanseníase: reação hansênica tipo eritema nodoso (ENH)</li>
      <li>DST/AIDS: úlceras aftosas em pacientes HIV+</li>
      <li>Lúpus eritematoso: manifestações cutâneas</li>
      <li>Mieloma múltiplo</li>
    </ul>
  </div>

  <div class="aviso-grave">
    <strong>RISCOS DA TALIDOMIDA:</strong>
    <ul style="margin: 3px 0;">
      <li><span class="obrigatorio">TERATOGENICIDADE:</span> Focomelia (ausência/encurtamento de membros), malformações cardíacas, renais, oculares, auditivas</li>
      <li>Neuropatia periférica (pode ser irreversível)</li>
      <li>Sonolência intensa</li>
      <li>Trombose venosa profunda</li>
    </ul>
  </div>

  ${isMulher ? `
  <div class="secao">
    <div class="secao-titulo">3. CONTRACEPÇÃO - MULHERES (OBRIGATÓRIO)</div>
    <div class="aviso-critico" style="font-size: 9pt;">
      GRAVIDEZ É ABSOLUTAMENTE CONTRAINDICADA
    </div>
    <div class="campo"><span class="campo-label">Teste de gravidez:</span> ${dataTesteGravidez ? new Date(dataTesteGravidez).toLocaleDateString('pt-BR') : '___/___/______'} | Resultado: <strong>NEGATIVO</strong></div>
    <div class="campo"><span class="campo-label">Método contraceptivo 1:</span> _____________________ | <span class="campo-label">Método 2:</span> _____________________</div>
    <p style="font-size: 8pt; margin-top: 5px;">Testes de gravidez obrigatórios: antes do início, semanalmente no 1º mês, depois mensalmente.</p>
  </div>
  ` : `
  <div class="secao">
    <div class="secao-titulo">3. CONTRACEPÇÃO - HOMENS</div>
    <p style="font-size: 8pt;">Homens em uso de talidomida devem usar preservativo em TODAS as relações sexuais, mesmo com parceira em uso de contraceptivo.</p>
  </div>
  `}

  <div class="secao">
    <div class="secao-titulo">4. DECLARAÇÕES DO PACIENTE</div>
    <div class="checkbox">Fui informado(a) que a talidomida causa DEFEITOS FÍSICOS GRAVES no feto;</div>
    <div class="checkbox">Compreendo que ${isMulher ? 'NÃO POSSO ENGRAVIDAR' : 'devo usar preservativo'} durante o tratamento;</div>
    <div class="checkbox">Sei que a talidomida pode causar neuropatia periférica irreversível;</div>
    <div class="checkbox">Comprometo-me a NÃO doar sangue durante e por 1 mês após o tratamento;</div>
    <div class="checkbox">NÃO compartilharei o medicamento com outras pessoas;</div>
    <div class="checkbox">Guardarei o medicamento em local seguro, fora do alcance de crianças;</div>
    <div class="checkbox">Devolverei as cápsulas não utilizadas ao serviço de saúde;</div>
    <div class="checkbox">Estou cadastrado(a) no Programa de Talidomida do Ministério da Saúde;</div>
    <div class="checkbox">Tive todas as minhas dúvidas esclarecidas e consinto com o tratamento.</div>
  </div>

  <div class="assinatura">
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${prescritor.nome}<br>CRM ${prescritor.crm}/${prescritor.uf}
      </div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha">
        ${paciente.nome}<br>CPF: ${paciente.cpf}
      </div>
    </div>
    <div class="assinatura-box">
      <div class="assinatura-linha">
        Testemunha<br>(se necessário)
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-top: 10px;"><strong>Data:</strong> ${dataFormatada}</div>

  <div class="vias">
    <strong>DOCUMENTO EM 3 VIAS:</strong> 1ª via - Prontuário | 2ª via - Farmácia/Programa MS | 3ª via - Paciente
  </div>
</body>
</html>`;
}
