/**
 * SI-PNI — Sistema de Informação do Programa Nacional de Imunizações
 * 
 * Integração com o sistema do Ministério da Saúde para registro de vacinação.
 * Referência: https://datasus.saude.gov.br/sipni/
 */

// ─── Tipos de Imunobiológicos (Código MS) ─────────────────────────────────────

export const IMUNOBIOLOGICOS = {
  BCG: { codigo: '1', nome: 'BCG', doencas: ['Tuberculose'] },
  HEPATITE_B: { codigo: '2', nome: 'Hepatite B', doencas: ['Hepatite B'] },
  PENTA: { codigo: '3', nome: 'Pentavalente (DTP+Hib+HB)', doencas: ['Difteria', 'Tétano', 'Coqueluche', 'Haemophilus', 'Hepatite B'] },
  VIP: { codigo: '4', nome: 'VIP (Polio Inativada)', doencas: ['Poliomielite'] },
  VOP: { codigo: '5', nome: 'VOP (Polio Oral)', doencas: ['Poliomielite'] },
  ROTAVIRUS: { codigo: '6', nome: 'Rotavírus Humano', doencas: ['Rotavírus'] },
  PNEUMO_10: { codigo: '7', nome: 'Pneumocócica 10-valente', doencas: ['Pneumonia', 'Meningite'] },
  MENINGO_C: { codigo: '8', nome: 'Meningocócica C', doencas: ['Meningite C'] },
  FEBRE_AMARELA: { codigo: '9', nome: 'Febre Amarela', doencas: ['Febre Amarela'] },
  TRIPLICE_VIRAL: { codigo: '10', nome: 'Tríplice Viral (SCR)', doencas: ['Sarampo', 'Caxumba', 'Rubéola'] },
  TETRA_VIRAL: { codigo: '11', nome: 'Tetra Viral', doencas: ['Sarampo', 'Caxumba', 'Rubéola', 'Varicela'] },
  DTP: { codigo: '12', nome: 'DTP', doencas: ['Difteria', 'Tétano', 'Coqueluche'] },
  HEPATITE_A: { codigo: '13', nome: 'Hepatite A', doencas: ['Hepatite A'] },
  VARICELA: { codigo: '14', nome: 'Varicela', doencas: ['Varicela'] },
  HPV_QUADRI: { codigo: '15', nome: 'HPV Quadrivalente', doencas: ['HPV'] },
  DTPA: { codigo: '16', nome: 'dTpa (Tríplice Acelular Adulto)', doencas: ['Difteria', 'Tétano', 'Coqueluche'] },
  DT: { codigo: '17', nome: 'dT (Dupla Adulto)', doencas: ['Difteria', 'Tétano'] },
  INFLUENZA: { codigo: '18', nome: 'Influenza', doencas: ['Gripe'] },
  PNEUMO_23: { codigo: '19', nome: 'Pneumocócica 23-valente', doencas: ['Pneumonia'] },
  COVID_19: { codigo: '20', nome: 'COVID-19', doencas: ['COVID-19'] },
  DENGUE: { codigo: '21', nome: 'Dengue', doencas: ['Dengue'] },
} as const;

// ─── Estratégias de Vacinação ─────────────────────────────────────────────────

export const ESTRATEGIAS = {
  ROTINA: { codigo: '1', nome: 'Rotina' },
  CAMPANHA: { codigo: '2', nome: 'Campanha' },
  BLOQUEIO: { codigo: '3', nome: 'Bloqueio' },
  ESPECIAL: { codigo: '4', nome: 'Especial (CRIE)' },
  INTENSIFICACAO: { codigo: '5', nome: 'Intensificação' },
} as const;

// ─── Doses ────────────────────────────────────────────────────────────────────

export const DOSES = {
  D1: { codigo: '1', nome: '1ª Dose' },
  D2: { codigo: '2', nome: '2ª Dose' },
  D3: { codigo: '3', nome: '3ª Dose' },
  D4: { codigo: '4', nome: '4ª Dose' },
  REF: { codigo: '5', nome: 'Reforço' },
  REF2: { codigo: '6', nome: '2º Reforço' },
  UNICA: { codigo: '7', nome: 'Dose Única' },
  ADICIONAL: { codigo: '8', nome: 'Dose Adicional' },
} as const;

// ─── Grupos de Atendimento ────────────────────────────────────────────────────

export const GRUPOS_ATENDIMENTO = {
  CRIANCA: { codigo: '1', nome: 'Criança' },
  ADOLESCENTE: { codigo: '2', nome: 'Adolescente' },
  ADULTO: { codigo: '3', nome: 'Adulto' },
  IDOSO: { codigo: '4', nome: 'Idoso' },
  GESTANTE: { codigo: '5', nome: 'Gestante' },
  PUERPERA: { codigo: '6', nome: 'Puérpera' },
  INDIGENA: { codigo: '7', nome: 'Indígena' },
  QUILOMBOLA: { codigo: '8', nome: 'Quilombola' },
  PROFISSIONAL_SAUDE: { codigo: '9', nome: 'Profissional de Saúde' },
  COMORBIDADE: { codigo: '10', nome: 'Pessoa com Comorbidade' },
} as const;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SIPNIPaciente {
  cns: string;
  cpf?: string;
  nome: string;
  dataNascimento: string;
  sexo: 'M' | 'F';
  nomeMae?: string;
  municipioResidencia?: string;
  ufResidencia?: string;
}

export interface SIPNIVacinacao {
  id?: string;
  paciente: SIPNIPaciente;
  imunobiologico: keyof typeof IMUNOBIOLOGICOS;
  dose: keyof typeof DOSES;
  lote: string;
  fabricante: string;
  dataAplicacao: string;
  estrategia: keyof typeof ESTRATEGIAS;
  grupoAtendimento: keyof typeof GRUPOS_ATENDIMENTO;
  localAplicacao: 'DELTÓIDE_D' | 'DELTÓIDE_E' | 'VASTO_LATERAL_D' | 'VASTO_LATERAL_E' | 'GLUTEO' | 'ORAL';
  viaAdministracao: 'IM' | 'SC' | 'ID' | 'VO';
  aplicador: { cns: string; nome: string; conselho?: string };
  estabelecimento: { cnes: string; nome: string };
}

export interface SIPNILote {
  numero: string;
  fabricante: string;
  validade: string;
  imunobiologico: keyof typeof IMUNOBIOLOGICOS;
  quantidadeRecebida: number;
  quantidadeUtilizada: number;
}

// ─── Gerador de XML SI-PNI ────────────────────────────────────────────────────

export function gerarXMLVacinacao(vacinacao: SIPNIVacinacao): string {
  const imuno = IMUNOBIOLOGICOS[vacinacao.imunobiologico];
  const dose = DOSES[vacinacao.dose];
  const estrategia = ESTRATEGIAS[vacinacao.estrategia];
  const grupo = GRUPOS_ATENDIMENTO[vacinacao.grupoAtendimento];

  return `<?xml version="1.0" encoding="UTF-8"?>
<registroVacinacao xmlns="http://datasus.saude.gov.br/sipni">
  <identificacao>
    <id>${vacinacao.id || crypto.randomUUID()}</id>
    <dataRegistro>${new Date().toISOString()}</dataRegistro>
  </identificacao>
  <paciente>
    <cns>${vacinacao.paciente.cns}</cns>
    <cpf>${vacinacao.paciente.cpf || ''}</cpf>
    <nome>${escapeXml(vacinacao.paciente.nome)}</nome>
    <dataNascimento>${vacinacao.paciente.dataNascimento}</dataNascimento>
    <sexo>${vacinacao.paciente.sexo}</sexo>
    <nomeMae>${escapeXml(vacinacao.paciente.nomeMae || '')}</nomeMae>
    <municipioResidencia>${vacinacao.paciente.municipioResidencia || ''}</municipioResidencia>
    <ufResidencia>${vacinacao.paciente.ufResidencia || ''}</ufResidencia>
  </paciente>
  <vacinacao>
    <imunobiologico>
      <codigo>${imuno.codigo}</codigo>
      <nome>${escapeXml(imuno.nome)}</nome>
    </imunobiologico>
    <dose>
      <codigo>${dose.codigo}</codigo>
      <descricao>${dose.nome}</descricao>
    </dose>
    <lote>${escapeXml(vacinacao.lote)}</lote>
    <fabricante>${escapeXml(vacinacao.fabricante)}</fabricante>
    <dataAplicacao>${vacinacao.dataAplicacao}</dataAplicacao>
    <estrategia>
      <codigo>${estrategia.codigo}</codigo>
      <descricao>${estrategia.nome}</descricao>
    </estrategia>
    <grupoAtendimento>
      <codigo>${grupo.codigo}</codigo>
      <descricao>${grupo.nome}</descricao>
    </grupoAtendimento>
    <localAplicacao>${vacinacao.localAplicacao}</localAplicacao>
    <viaAdministracao>${vacinacao.viaAdministracao}</viaAdministracao>
  </vacinacao>
  <aplicador>
    <cns>${vacinacao.aplicador.cns}</cns>
    <nome>${escapeXml(vacinacao.aplicador.nome)}</nome>
    <conselho>${vacinacao.aplicador.conselho || ''}</conselho>
  </aplicador>
  <estabelecimento>
    <cnes>${vacinacao.estabelecimento.cnes}</cnes>
    <nome>${escapeXml(vacinacao.estabelecimento.nome)}</nome>
  </estabelecimento>
</registroVacinacao>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Validação de CNS ─────────────────────────────────────────────────────────

export function validarCNS(cns: string): boolean {
  const cleanCns = cns.replace(/\D/g, '');
  if (cleanCns.length !== 15) return false;
  
  const firstDigit = parseInt(cleanCns[0], 10);
  
  if ([1, 2].includes(firstDigit)) {
    return validarCNSDefinitivo(cleanCns);
  } else if ([7, 8, 9].includes(firstDigit)) {
    return validarCNSProvisorio(cleanCns);
  }
  
  return false;
}

function validarCNSDefinitivo(cns: string): boolean {
  const pis = cns.substring(0, 11);
  let soma = 0;
  for (let i = 0; i < 11; i++) {
    soma += parseInt(pis[i], 10) * (15 - i);
  }
  const resto = soma % 11;
  const dv = resto === 0 ? 0 : 11 - resto;
  
  let resultado = pis + '001' + dv.toString();
  if (dv === 10) {
    soma = 0;
    for (let i = 0; i < 11; i++) {
      soma += parseInt(pis[i], 10) * (15 - i);
    }
    soma += 2 * 3 + 1 * 2;
    const resto2 = soma % 11;
    const dv2 = resto2 === 0 ? 0 : 11 - resto2;
    resultado = pis + '002' + dv2.toString();
  }
  
  return resultado === cns;
}

function validarCNSProvisorio(cns: string): boolean {
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    soma += parseInt(cns[i], 10) * (15 - i);
  }
  return soma % 11 === 0;
}

// ─── Calendário Vacinal ───────────────────────────────────────────────────────

export interface VacinaCalendario {
  imunobiologico: keyof typeof IMUNOBIOLOGICOS;
  doses: Array<{ dose: keyof typeof DOSES; idadeMinima: string; idadeMaxima?: string }>;
  intervaloMinimo?: number;
}

export const CALENDARIO_CRIANCA: VacinaCalendario[] = [
  { imunobiologico: 'BCG', doses: [{ dose: 'UNICA', idadeMinima: 'ao nascer' }] },
  { imunobiologico: 'HEPATITE_B', doses: [{ dose: 'D1', idadeMinima: 'ao nascer', idadeMaxima: '30 dias' }] },
  { imunobiologico: 'PENTA', doses: [
    { dose: 'D1', idadeMinima: '2 meses' },
    { dose: 'D2', idadeMinima: '4 meses' },
    { dose: 'D3', idadeMinima: '6 meses' },
  ], intervaloMinimo: 60 },
  { imunobiologico: 'VIP', doses: [
    { dose: 'D1', idadeMinima: '2 meses' },
    { dose: 'D2', idadeMinima: '4 meses' },
    { dose: 'D3', idadeMinima: '6 meses' },
  ], intervaloMinimo: 60 },
  { imunobiologico: 'VOP', doses: [
    { dose: 'REF', idadeMinima: '15 meses' },
    { dose: 'REF2', idadeMinima: '4 anos' },
  ] },
  { imunobiologico: 'ROTAVIRUS', doses: [
    { dose: 'D1', idadeMinima: '2 meses', idadeMaxima: '3 meses e 15 dias' },
    { dose: 'D2', idadeMinima: '4 meses', idadeMaxima: '7 meses e 29 dias' },
  ], intervaloMinimo: 30 },
  { imunobiologico: 'PNEUMO_10', doses: [
    { dose: 'D1', idadeMinima: '2 meses' },
    { dose: 'D2', idadeMinima: '4 meses' },
    { dose: 'REF', idadeMinima: '12 meses' },
  ] },
  { imunobiologico: 'MENINGO_C', doses: [
    { dose: 'D1', idadeMinima: '3 meses' },
    { dose: 'D2', idadeMinima: '5 meses' },
    { dose: 'REF', idadeMinima: '12 meses' },
  ] },
  { imunobiologico: 'FEBRE_AMARELA', doses: [
    { dose: 'D1', idadeMinima: '9 meses' },
    { dose: 'REF', idadeMinima: '4 anos' },
  ] },
  { imunobiologico: 'TRIPLICE_VIRAL', doses: [
    { dose: 'D1', idadeMinima: '12 meses' },
    { dose: 'D2', idadeMinima: '15 meses' },
  ] },
  { imunobiologico: 'DTP', doses: [
    { dose: 'REF', idadeMinima: '15 meses' },
    { dose: 'REF2', idadeMinima: '4 anos' },
  ] },
  { imunobiologico: 'HEPATITE_A', doses: [{ dose: 'UNICA', idadeMinima: '15 meses' }] },
  { imunobiologico: 'VARICELA', doses: [{ dose: 'UNICA', idadeMinima: '4 anos' }] },
];

// ─── Verificação de Atraso Vacinal ────────────────────────────────────────────

export interface AtrasoVacinal {
  imunobiologico: string;
  dose: string;
  idadeRecomendada: string;
  diasAtraso: number;
}

export function verificarAtrasosVacinais(
  dataNascimento: string,
  vacinasAplicadas: Array<{ imunobiologico: string; dose: string; dataAplicacao: string }>
): AtrasoVacinal[] {
  const atrasos: AtrasoVacinal[] = [];
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  const idadeMeses = Math.floor((hoje.getTime() - nascimento.getTime()) / (1000 * 60 * 60 * 24 * 30));
  
  for (const vacina of CALENDARIO_CRIANCA) {
    for (const doseInfo of vacina.doses) {
      const aplicada = vacinasAplicadas.find(
        v => v.imunobiologico === vacina.imunobiologico && v.dose === doseInfo.dose
      );
      
      if (!aplicada) {
        const idadeMinimaMeses = parseIdadeParaMeses(doseInfo.idadeMinima);
        if (idadeMeses > idadeMinimaMeses) {
          const diasAtraso = (idadeMeses - idadeMinimaMeses) * 30;
          atrasos.push({
            imunobiologico: IMUNOBIOLOGICOS[vacina.imunobiologico].nome,
            dose: DOSES[doseInfo.dose].nome,
            idadeRecomendada: doseInfo.idadeMinima,
            diasAtraso,
          });
        }
      }
    }
  }
  
  return atrasos;
}

function parseIdadeParaMeses(idade: string): number {
  if (idade === 'ao nascer') return 0;
  const match = idade.match(/(\d+)\s*(meses?|anos?)/i);
  if (!match) return 0;
  const valor = parseInt(match[1], 10);
  const unidade = match[2].toLowerCase();
  return unidade.startsWith('ano') ? valor * 12 : valor;
}

// ─── Relatório de Cobertura Vacinal ───────────────────────────────────────────

export interface CoberturaVacinal {
  imunobiologico: string;
  meta: number;
  aplicadas: number;
  cobertura: number;
  status: 'ADEQUADA' | 'ALERTA' | 'CRITICA';
}

export function calcularCoberturaVacinal(
  populacaoAlvo: number,
  vacinasAplicadas: Array<{ imunobiologico: string }>,
  meta: number = 95
): CoberturaVacinal[] {
  const contagem: Record<string, number> = {};
  
  for (const v of vacinasAplicadas) {
    contagem[v.imunobiologico] = (contagem[v.imunobiologico] || 0) + 1;
  }
  
  return Object.entries(IMUNOBIOLOGICOS).map(([key, value]) => {
    const aplicadas = contagem[key] || 0;
    const cobertura = populacaoAlvo > 0 ? (aplicadas / populacaoAlvo) * 100 : 0;
    
    let status: CoberturaVacinal['status'] = 'ADEQUADA';
    if (cobertura < meta * 0.8) status = 'CRITICA';
    else if (cobertura < meta) status = 'ALERTA';
    
    return {
      imunobiologico: value.nome,
      meta,
      aplicadas,
      cobertura: Math.round(cobertura * 100) / 100,
      status,
    };
  });
}
