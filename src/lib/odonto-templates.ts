/**
 * Templates Odontológicos — Receituários, Atestados e Orientações
 * Fase 25G — Receituário e Atestado Odontológico
 */

// ─── Medicamentos Odontológicos (mínimo 20) ─────────────────────────────────

export interface MedicamentoOdonto {
  nome: string;
  principioAtivo: string;
  apresentacao: string;
  posologia: string;
  duracao: string;
  categoria: "analgesico" | "antiinflamatorio" | "antibiotico" | "antisseptico" | "anestesico" | "outro";
  controlado: boolean;
  observacoes?: string;
}

export const MEDICAMENTOS_ODONTO: MedicamentoOdonto[] = [
  // Analgésicos (5)
  {
    nome: "Dipirona 500mg",
    principioAtivo: "Dipirona sódica",
    apresentacao: "Comprimidos - caixa com 20",
    posologia: "1 comprimido de 6/6 horas",
    duracao: "3 a 5 dias",
    categoria: "analgesico",
    controlado: false,
    observacoes: "Tomar se dor. Não exceder 4g/dia.",
  },
  {
    nome: "Paracetamol 750mg",
    principioAtivo: "Paracetamol",
    apresentacao: "Comprimidos - caixa com 20",
    posologia: "1 comprimido de 6/6 horas",
    duracao: "3 a 5 dias",
    categoria: "analgesico",
    controlado: false,
    observacoes: "Alternativa para alérgicos a dipirona.",
  },
  {
    nome: "Tylenol Codeína",
    principioAtivo: "Paracetamol + Codeína",
    apresentacao: "Comprimidos - caixa com 12",
    posologia: "1 comprimido de 6/6 horas",
    duracao: "3 dias",
    categoria: "analgesico",
    controlado: true,
    observacoes: "Para dor intensa. Receita especial B.",
  },
  {
    nome: "Tramadol 50mg",
    principioAtivo: "Cloridrato de tramadol",
    apresentacao: "Cápsulas - caixa com 10",
    posologia: "1 cápsula de 8/8 horas",
    duracao: "3 dias",
    categoria: "analgesico",
    controlado: true,
    observacoes: "Para dor intensa pós-cirúrgica. Receita especial B.",
  },
  {
    nome: "Lisador",
    principioAtivo: "Dipirona + Cafeína + Orfenadrina",
    apresentacao: "Comprimidos - caixa com 24",
    posologia: "1 comprimido de 6/6 horas",
    duracao: "3 dias",
    categoria: "analgesico",
    controlado: false,
  },

  // Anti-inflamatórios (6)
  {
    nome: "Nimesulida 100mg",
    principioAtivo: "Nimesulida",
    apresentacao: "Comprimidos - caixa com 12",
    posologia: "1 comprimido de 12/12 horas",
    duracao: "3 a 5 dias",
    categoria: "antiinflamatorio",
    controlado: false,
    observacoes: "Tomar após as refeições.",
  },
  {
    nome: "Ibuprofeno 600mg",
    principioAtivo: "Ibuprofeno",
    apresentacao: "Comprimidos - caixa com 20",
    posologia: "1 comprimido de 8/8 horas",
    duracao: "5 dias",
    categoria: "antiinflamatorio",
    controlado: false,
    observacoes: "Tomar com alimentos.",
  },
  {
    nome: "Cetoprofeno 100mg",
    principioAtivo: "Cetoprofeno",
    apresentacao: "Comprimidos - caixa com 20",
    posologia: "1 comprimido de 12/12 horas",
    duracao: "5 dias",
    categoria: "antiinflamatorio",
    controlado: false,
  },
  {
    nome: "Dexametasona 4mg",
    principioAtivo: "Dexametasona",
    apresentacao: "Comprimidos - caixa com 10",
    posologia: "1 comprimido pela manhã",
    duracao: "3 dias",
    categoria: "antiinflamatorio",
    controlado: false,
    observacoes: "Corticoide. Usar em casos de edema intenso.",
  },
  {
    nome: "Decadron 4mg",
    principioAtivo: "Dexametasona",
    apresentacao: "Comprimidos - caixa com 10",
    posologia: "1 comprimido 1 hora antes do procedimento",
    duracao: "Dose única",
    categoria: "antiinflamatorio",
    controlado: false,
    observacoes: "Profilaxia de edema pré-cirúrgico.",
  },
  {
    nome: "Toragesic 10mg",
    principioAtivo: "Cetorolaco de trometamina",
    apresentacao: "Comprimidos sublinguais - caixa com 10",
    posologia: "1 comprimido sublingual de 8/8 horas",
    duracao: "2 dias",
    categoria: "antiinflamatorio",
    controlado: false,
    observacoes: "Potente analgésico/anti-inflamatório.",
  },

  // Antibióticos (7)
  {
    nome: "Amoxicilina 500mg",
    principioAtivo: "Amoxicilina",
    apresentacao: "Cápsulas - caixa com 21",
    posologia: "1 cápsula de 8/8 horas",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Antibiótico de primeira escolha.",
  },
  {
    nome: "Amoxicilina + Clavulanato 875mg",
    principioAtivo: "Amoxicilina + Ácido clavulânico",
    apresentacao: "Comprimidos - caixa com 14",
    posologia: "1 comprimido de 12/12 horas",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Para infecções resistentes.",
  },
  {
    nome: "Azitromicina 500mg",
    principioAtivo: "Azitromicina",
    apresentacao: "Comprimidos - caixa com 3",
    posologia: "1 comprimido ao dia",
    duracao: "3 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Alternativa para alérgicos a penicilina.",
  },
  {
    nome: "Clindamicina 300mg",
    principioAtivo: "Clindamicina",
    apresentacao: "Cápsulas - caixa com 16",
    posologia: "1 cápsula de 8/8 horas",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Para alérgicos a penicilina. Boa penetração óssea.",
  },
  {
    nome: "Metronidazol 400mg",
    principioAtivo: "Metronidazol",
    apresentacao: "Comprimidos - caixa com 24",
    posologia: "1 comprimido de 8/8 horas",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Para anaeróbios. Não ingerir álcool.",
  },
  {
    nome: "Cefalexina 500mg",
    principioAtivo: "Cefalexina",
    apresentacao: "Cápsulas - caixa com 8",
    posologia: "1 cápsula de 6/6 horas",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
  },
  {
    nome: "Levofloxacino 500mg",
    principioAtivo: "Levofloxacino",
    apresentacao: "Comprimidos - caixa com 7",
    posologia: "1 comprimido ao dia",
    duracao: "7 dias",
    categoria: "antibiotico",
    controlado: false,
    observacoes: "Reservar para casos específicos.",
  },

  // Antissépticos e outros (4)
  {
    nome: "Periogard",
    principioAtivo: "Digluconato de clorexidina 0,12%",
    apresentacao: "Solução bucal - frasco 250ml",
    posologia: "Bochechar 15ml por 30 segundos, 2x ao dia",
    duracao: "7 a 14 dias",
    categoria: "antisseptico",
    controlado: false,
    observacoes: "Não enxaguar após. Usar 30min após escovação.",
  },
  {
    nome: "Malvatricin",
    principioAtivo: "Tirotricina + Benzocaína",
    apresentacao: "Solução bucal - frasco 100ml",
    posologia: "Bochechar 3x ao dia",
    duracao: "5 dias",
    categoria: "antisseptico",
    controlado: false,
  },
  {
    nome: "Omcilon-A Orabase",
    principioAtivo: "Triancinolona acetonida",
    apresentacao: "Pomada - bisnaga 10g",
    posologia: "Aplicar na lesão 3x ao dia",
    duracao: "7 dias",
    categoria: "outro",
    controlado: false,
    observacoes: "Para aftas e lesões bucais.",
  },
  {
    nome: "Gingilone",
    principioAtivo: "Hidrocortisona + Neomicina",
    apresentacao: "Pomada - bisnaga 10g",
    posologia: "Aplicar na gengiva 3x ao dia",
    duracao: "5 dias",
    categoria: "outro",
    controlado: false,
    observacoes: "Para gengivite e lesões gengivais.",
  },
];

// ─── Templates de Orientações Pós-Operatórias ───────────────────────────────

export interface OrientacaoPosOp {
  key: string;
  titulo: string;
  procedimento: string;
  orientacoes: string[];
  cuidadosEspeciais?: string[];
  sinaisAlerta: string[];
  retorno: string;
}

export const ORIENTACOES_POS_OP: OrientacaoPosOp[] = [
  {
    key: "extracao",
    titulo: "Orientações Pós-Extração Dentária",
    procedimento: "Extração dentária / Exodontia",
    orientacoes: [
      "Morder a gaze por 30 a 40 minutos sem trocar",
      "Não cuspir, não bochechar e não usar canudo nas primeiras 24 horas",
      "Aplicar gelo externamente na face (15 min com intervalo de 15 min) nas primeiras 24 horas",
      "Alimentação líquida/pastosa e fria nas primeiras 24 horas",
      "Não fumar por pelo menos 72 horas (risco de alveolite)",
      "Não consumir bebidas alcoólicas durante o tratamento",
      "Dormir com a cabeça elevada na primeira noite",
      "Evitar esforço físico por 48 horas",
      "Iniciar escovação suave após 24 horas, evitando a região operada",
      "Tomar a medicação prescrita nos horários corretos",
    ],
    cuidadosEspeciais: [
      "Se houver sangramento, morder nova gaze por mais 30 minutos",
      "Pequeno sangramento nas primeiras 24h é normal",
      "Inchaço é esperado e atinge pico em 48-72 horas",
    ],
    sinaisAlerta: [
      "Sangramento intenso que não para com compressão",
      "Dor intensa que não melhora com medicação",
      "Febre acima de 38°C",
      "Dificuldade para engolir ou respirar",
      "Pus ou secreção com odor fétido",
    ],
    retorno: "Retornar em 7 dias para remoção de pontos (se houver) e avaliação",
  },
  {
    key: "implante",
    titulo: "Orientações Pós-Implante Dentário",
    procedimento: "Instalação de implante dentário",
    orientacoes: [
      "Morder a gaze por 30 a 40 minutos",
      "Aplicar gelo externamente (15 min com intervalo de 15 min) nas primeiras 48 horas",
      "Alimentação líquida/pastosa e fria por 7 dias",
      "Não mastigar do lado operado por 14 dias",
      "Não fumar por pelo menos 2 semanas (compromete osseointegração)",
      "Não consumir bebidas alcoólicas durante o tratamento",
      "Evitar esforço físico por 7 dias",
      "Dormir com a cabeça elevada por 3 noites",
      "Escovação suave com escova macia, evitando a região",
      "Usar o enxaguante bucal prescrito após 24 horas",
      "Tomar toda a medicação prescrita corretamente",
    ],
    cuidadosEspeciais: [
      "Não usar prótese removível sobre a região por 14 dias",
      "Evitar pressão sobre o implante",
      "Inchaço e hematoma são esperados por até 7 dias",
    ],
    sinaisAlerta: [
      "Sangramento intenso persistente",
      "Dor intensa que não cede com medicação",
      "Febre acima de 38°C",
      "Mobilidade do implante",
      "Pus ou secreção purulenta",
      "Dormência persistente após 24 horas",
    ],
    retorno: "Retornar em 7-10 dias para remoção de pontos e em 3-6 meses para segunda fase",
  },
  {
    key: "periodontia",
    titulo: "Orientações Pós-Cirurgia Periodontal",
    procedimento: "Cirurgia periodontal / Gengivoplastia / Enxerto gengival",
    orientacoes: [
      "Morder a gaze por 30 minutos",
      "Aplicar gelo externamente nas primeiras 24 horas",
      "Alimentação líquida/pastosa por 5 dias",
      "Não escovar a região operada por 14 dias",
      "Usar o enxaguante de clorexidina 2x ao dia por 14 dias",
      "Não puxar o lábio para ver a região operada",
      "Evitar alimentos duros, ácidos ou condimentados",
      "Não fumar durante todo o período de cicatrização",
      "Evitar esforço físico por 5 dias",
    ],
    cuidadosEspeciais: [
      "Se houver enxerto, não tocar na região",
      "Usar cimento cirúrgico se prescrito",
      "Sangramento leve é normal nas primeiras 24h",
    ],
    sinaisAlerta: [
      "Sangramento que não para",
      "Dor intensa não controlada",
      "Febre",
      "Inchaço excessivo",
      "Deslocamento do enxerto",
      "Pus ou odor fétido",
    ],
    retorno: "Retornar em 7 dias para avaliação e em 14 dias para remoção de pontos",
  },
  {
    key: "endodontia",
    titulo: "Orientações Pós-Tratamento de Canal",
    procedimento: "Tratamento endodôntico / Canal",
    orientacoes: [
      "Evitar mastigar do lado tratado até a restauração definitiva",
      "Sensibilidade é normal por 3-5 dias",
      "Tomar a medicação prescrita nos horários corretos",
      "Manter boa higiene bucal",
      "Não morder alimentos duros com o dente tratado",
      "Retornar para restauração definitiva o mais breve possível",
    ],
    cuidadosEspeciais: [
      "O dente pode ficar sensível à percussão por alguns dias",
      "A restauração provisória pode cair - retorne se isso ocorrer",
      "Dente tratado fica mais frágil - evitar forças excessivas",
    ],
    sinaisAlerta: [
      "Dor intensa que não melhora após 5 dias",
      "Inchaço na face ou gengiva",
      "Febre",
      "Sensação de dente \"crescido\"",
      "Pus ou fístula na gengiva",
      "Queda da restauração provisória",
    ],
    retorno: "Retornar em 7-15 dias para restauração definitiva",
  },
  {
    key: "clareamento",
    titulo: "Orientações Pós-Clareamento Dental",
    procedimento: "Clareamento dental",
    orientacoes: [
      "Evitar alimentos e bebidas com corantes por 48 horas (café, vinho, açaí, beterraba, molho de tomate)",
      "Não fumar durante o tratamento",
      "Sensibilidade é normal e temporária",
      "Usar creme dental para sensibilidade se necessário",
      "Manter boa higiene bucal",
      "Evitar bebidas ácidas nas primeiras 24 horas",
      "Usar o gel clareador conforme orientado (se caseiro)",
    ],
    cuidadosEspeciais: [
      "Sensibilidade geralmente desaparece em 24-48 horas",
      "Resultado final é avaliado após 14 dias",
      "Cor pode regredir levemente após estabilização",
    ],
    sinaisAlerta: [
      "Sensibilidade intensa que não melhora",
      "Dor espontânea",
      "Irritação gengival intensa",
      "Manchas brancas persistentes",
    ],
    retorno: "Retornar conforme agendamento para próxima sessão ou avaliação final",
  },
];

// ─── Template de Atestado Odontológico ──────────────────────────────────────

export interface AtestadoOdontoData {
  pacienteNome: string;
  pacienteCpf?: string;
  procedimento: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  diasAfastamento: number;
  cid?: string;
  observacoes?: string;
  profissionalNome: string;
  profissionalCro: string;
  profissionalUf: string;
}

export function gerarTextoAtestadoOdonto(data: AtestadoOdontoData): string {
  const dataFormatada = new Date(data.data).toLocaleDateString("pt-BR");
  const horario = data.horaInicio && data.horaFim 
    ? ` no período das ${data.horaInicio} às ${data.horaFim}` 
    : "";
  
  let texto = `ATESTADO ODONTOLÓGICO\n\n`;
  texto += `Atesto para os devidos fins que o(a) paciente ${data.pacienteNome}`;
  if (data.pacienteCpf) texto += `, CPF ${data.pacienteCpf},`;
  texto += ` esteve sob meus cuidados profissionais no dia ${dataFormatada}${horario}`;
  texto += `, submetendo-se ao procedimento de ${data.procedimento}`;
  if (data.cid) texto += ` (CID: ${data.cid})`;
  texto += `.\n\n`;
  
  if (data.diasAfastamento > 0) {
    texto += `Necessita de afastamento de suas atividades por ${data.diasAfastamento} (${extenso(data.diasAfastamento)}) dia${data.diasAfastamento > 1 ? "s" : ""}.\n\n`;
  }
  
  if (data.observacoes) {
    texto += `Observações: ${data.observacoes}\n\n`;
  }
  
  texto += `${data.profissionalNome}\n`;
  texto += `CRO-${data.profissionalUf} ${data.profissionalCro}\n`;
  texto += `Cirurgião(ã)-Dentista`;
  
  return texto;
}

function extenso(n: number): string {
  const nomes = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
    "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte",
    "vinte e um", "vinte e dois", "vinte e três", "vinte e quatro", "vinte e cinco", "vinte e seis",
    "vinte e sete", "vinte e oito", "vinte e nove", "trinta"];
  return nomes[n] || String(n);
}

// ─── Template de Encaminhamento Odontológico ────────────────────────────────

export interface EncaminhamentoOdontoData {
  pacienteNome: string;
  pacienteIdade?: number;
  especialidade: string;
  motivoEncaminhamento: string;
  historiaClinica?: string;
  examesRealizados?: string;
  hipoteseDiagnostica?: string;
  urgencia: "eletivo" | "urgente" | "emergencia";
  profissionalNome: string;
  profissionalCro: string;
  profissionalUf: string;
  data: string;
}

export const ESPECIALIDADES_ODONTO = [
  { key: "endodontia", nome: "Endodontia", descricao: "Tratamento de canal" },
  { key: "periodontia", nome: "Periodontia", descricao: "Doenças da gengiva e osso" },
  { key: "cirurgia_bmf", nome: "Cirurgia Bucomaxilofacial", descricao: "Cirurgias complexas, traumas, tumores" },
  { key: "ortodontia", nome: "Ortodontia", descricao: "Correção de posição dentária" },
  { key: "implantodontia", nome: "Implantodontia", descricao: "Implantes dentários" },
  { key: "protese", nome: "Prótese Dentária", descricao: "Reabilitação protética" },
  { key: "odontopediatria", nome: "Odontopediatria", descricao: "Atendimento infantil" },
  { key: "estomatologia", nome: "Estomatologia", descricao: "Lesões bucais, diagnóstico" },
  { key: "disfuncao_atm", nome: "Disfunção Temporomandibular", descricao: "DTM e dor orofacial" },
  { key: "radiologia", nome: "Radiologia Odontológica", descricao: "Exames de imagem" },
];

export function gerarTextoEncaminhamentoOdonto(data: EncaminhamentoOdontoData): string {
  const dataFormatada = new Date(data.data).toLocaleDateString("pt-BR");
  const urgenciaTexto = {
    eletivo: "Eletivo",
    urgente: "Urgente",
    emergencia: "Emergência",
  }[data.urgencia];
  
  let texto = `ENCAMINHAMENTO ODONTOLÓGICO\n\n`;
  texto += `Data: ${dataFormatada}\n`;
  texto += `Caráter: ${urgenciaTexto}\n\n`;
  texto += `Encaminho o(a) paciente ${data.pacienteNome}`;
  if (data.pacienteIdade) texto += `, ${data.pacienteIdade} anos,`;
  texto += ` para avaliação e conduta em ${data.especialidade}.\n\n`;
  
  texto += `MOTIVO DO ENCAMINHAMENTO:\n${data.motivoEncaminhamento}\n\n`;
  
  if (data.historiaClinica) {
    texto += `HISTÓRIA CLÍNICA:\n${data.historiaClinica}\n\n`;
  }
  
  if (data.examesRealizados) {
    texto += `EXAMES REALIZADOS:\n${data.examesRealizados}\n\n`;
  }
  
  if (data.hipoteseDiagnostica) {
    texto += `HIPÓTESE DIAGNÓSTICA:\n${data.hipoteseDiagnostica}\n\n`;
  }
  
  texto += `Atenciosamente,\n\n`;
  texto += `${data.profissionalNome}\n`;
  texto += `CRO-${data.profissionalUf} ${data.profissionalCro}\n`;
  texto += `Cirurgião(ã)-Dentista`;
  
  return texto;
}

// ─── CIDs Odontológicos Comuns ──────────────────────────────────────────────

export const CIDS_ODONTO = [
  { codigo: "K00", descricao: "Distúrbios do desenvolvimento e da erupção dos dentes" },
  { codigo: "K01", descricao: "Dentes inclusos e impactados" },
  { codigo: "K02", descricao: "Cárie dentária" },
  { codigo: "K02.0", descricao: "Cárie limitada ao esmalte" },
  { codigo: "K02.1", descricao: "Cárie da dentina" },
  { codigo: "K02.2", descricao: "Cárie do cemento" },
  { codigo: "K03", descricao: "Outras doenças dos tecidos duros dos dentes" },
  { codigo: "K04", descricao: "Doenças da polpa e dos tecidos periapicais" },
  { codigo: "K04.0", descricao: "Pulpite" },
  { codigo: "K04.1", descricao: "Necrose da polpa" },
  { codigo: "K04.4", descricao: "Periodontite apical aguda de origem pulpar" },
  { codigo: "K04.5", descricao: "Periodontite apical crônica" },
  { codigo: "K04.6", descricao: "Abscesso periapical com fístula" },
  { codigo: "K04.7", descricao: "Abscesso periapical sem fístula" },
  { codigo: "K05", descricao: "Gengivite e doenças periodontais" },
  { codigo: "K05.0", descricao: "Gengivite aguda" },
  { codigo: "K05.1", descricao: "Gengivite crônica" },
  { codigo: "K05.2", descricao: "Periodontite aguda" },
  { codigo: "K05.3", descricao: "Periodontite crônica" },
  { codigo: "K05.4", descricao: "Periodontose" },
  { codigo: "K06", descricao: "Outros transtornos da gengiva e do rebordo alveolar" },
  { codigo: "K07", descricao: "Anomalias dentofaciais (inclusive má oclusão)" },
  { codigo: "K08", descricao: "Outros transtornos dos dentes e estruturas de suporte" },
  { codigo: "K08.1", descricao: "Perda de dentes devida a acidente, extração ou doença periodontal" },
  { codigo: "K08.3", descricao: "Raiz dentária retida" },
  { codigo: "K09", descricao: "Cistos da região bucal não classificados em outra parte" },
  { codigo: "K10", descricao: "Outras doenças dos maxilares" },
  { codigo: "K11", descricao: "Doenças das glândulas salivares" },
  { codigo: "K12", descricao: "Estomatite e lesões afins" },
  { codigo: "K12.0", descricao: "Aftas bucais recidivantes" },
  { codigo: "K13", descricao: "Outras doenças do lábio e da mucosa oral" },
  { codigo: "S02.5", descricao: "Fratura de dente" },
];
