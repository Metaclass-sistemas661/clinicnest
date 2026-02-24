// SNGPC XML - Formato Oficial ANVISA
// Baseado nos schemas XSD: sngpc.xsd, sngpcSimpleTypes.xsd, sngpcComplexTypes.xsd
// Namespace: urn:sngpc-schema

// ============================================================================
// TIPOS SIMPLES (sngpcSimpleTypes.xsd)
// ============================================================================

export type ClasseTerapeutica = '1' | '2'; // 1=Antimicrobiano, 2=Controle Especial

export type TipoReceituario = '1' | '2' | '3' | '4' | '5';
// 1=Receita Controle Especial 2 vias (Branca)
// 2=Notificação Receita B (Azul)
// 3=Notificação Receita Especial (Branca)
// 4=Notificação Receita A (Amarela)
// 5=Receita Antimicrobiano 2 vias

export type TipoUsoMedicamento = '1' | '2'; // 1=Humano, 2=Veterinário

export type TipoOperacaoNotaFiscal = '1' | '2' | '3'; // 1=Compra, 2=Transferência, 3=Venda

export type TipoMotivoPerda = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
// 1=Furto/Roubo, 2=Avaria, 3=Vencimento, 4=Apreensão/Recolhimento Visa
// 5=Perda no processo, 6=Coleta controle qualidade, 7=Perda exclusão 344
// 8=Desvio qualidade, 9=Recolhimento Fabricante, 10=Devolução fornecedor

export type TipoUnidadeInsumo = '1' | '2' | '3'; // 1=Grama, 2=Mililitro, 3=Unidade(U)

export type TipoUnidadeFarmacotecnica = 1 | 2 | 3 | 4; // 1=Grama, 2=Cápsula, 3=Comprimido, 4=Mililitro

export type UnidadeMedidaMedicamento = '1' | '2'; // 1=Caixas, 2=Frascos

export type ConselhoProfissional = 'CRM' | 'CRMV' | 'CRO' | 'CRF' | 'RMS';

export type UF = 'AC'|'AL'|'AM'|'AP'|'BA'|'CE'|'DF'|'ES'|'GO'|'MA'|'MG'|'MS'|'MT'|'PA'|'PB'|'PE'|'PI'|'PR'|'RJ'|'RN'|'RO'|'RR'|'RS'|'SC'|'SE'|'SP'|'TO';

export type SimNao = 'S' | 'N';
export type SimNaoNull = 'S' | 'N' | '';

export type Sexo = 1 | 2; // 1=Masculino, 2=Feminino
export type UnidadeIdade = 1 | 2; // 1=Anos, 2=Meses

// ============================================================================
// TIPOS COMPLEXOS (sngpcComplexTypes.xsd)
// ============================================================================

export interface Medicamento {
  registroMSMedicamento: string; // 13-14 dígitos, inicia com "1"
  numeroLoteMedicamento: string; // max 20 chars
  quantidadeMedicamento: number; // max 6 dígitos, > 0
  unidadeMedidaMedicamento: UnidadeMedidaMedicamento;
}

export interface MedicamentoEntrada extends Medicamento {
  classeTerapeutica: ClasseTerapeutica;
}

export interface MedicamentoVenda extends Medicamento {
  usoProlongado: SimNaoNull;
}

export interface NotaFiscal {
  numeroNotaFiscal: number; // max 9 dígitos
  tipoOperacaoNotaFiscal: TipoOperacaoNotaFiscal;
  dataNotaFiscal: string; // yyyy-mm-dd
  cnpjOrigem: string; // 14 dígitos
  cnpjDestino: string; // 14 dígitos
}

export interface Prescritor {
  nomePrescritor: string; // max 100 chars
  numeroRegistroProfissional: string; // max 30 chars
  conselhoProfissional: ConselhoProfissional;
  UFConselho: UF;
}

export interface Comprador {
  nomeComprador: string; // max 100 chars
  tipoDocumento: string; // ver enum st_TipoDocumento
  numeroDocumento: string; // max 30 chars
  orgaoExpedidor: string; // ver enum st_OrgaoExpedidor
  UFEmissaoDocumento: UF;
}

export interface Paciente {
  nome: string;
  idade: number; // 0-999
  unidadeIdade: UnidadeIdade;
  sexo: Sexo;
  cid: string; // max 4 chars
}

// ============================================================================
// OPERAÇÕES (sngpcOperacoes.xsd)
// ============================================================================

export interface EntradaMedicamento {
  notaFiscalEntradaMedicamento: NotaFiscal;
  medicamentoEntrada: MedicamentoEntrada;
  dataRecebimentoMedicamento: string; // yyyy-mm-dd
}

export interface SaidaMedicamentoVendaAoConsumidor {
  tipoReceituarioMedicamento: TipoReceituario;
  numeroNotificacaoMedicamento?: string; // max 10 chars
  dataPrescricaoMedicamento: string; // yyyy-mm-dd
  prescritorMedicamento: Prescritor;
  usoMedicamento: TipoUsoMedicamento;
  compradorMedicamento: Comprador;
  medicamentoVenda: MedicamentoVenda;
  dataVendaMedicamento: string; // yyyy-mm-dd
}

export interface SaidaMedicamentoTransferencia {
  notaFiscalTransferenciaMedicamento: NotaFiscal;
  medicamentoTransferencia: Medicamento;
  dataTransferenciaMedicamento: string; // yyyy-mm-dd
}

export interface SaidaMedicamentoPerda {
  motivoPerda: TipoMotivoPerda;
  medicamentoPerda: Medicamento;
  dataPerdaMedicamento: string; // yyyy-mm-dd
  observacao?: string;
}

// ============================================================================
// MENSAGEM PRINCIPAL (sngpc.xsd)
// ============================================================================

export interface CabecalhoMovimentacao {
  cnpjEmissor: string; // 14 dígitos
  cpfTransmissor: string; // 11 dígitos
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
}

export interface CabecalhoInventario {
  cnpjEmissor: string;
  cpfTransmissor: string;
  data: string; // yyyy-mm-dd
}

export interface CorpoMedicamentos {
  entradaMedicamentos?: EntradaMedicamento[];
  saidaMedicamentoVendaAoConsumidor?: SaidaMedicamentoVendaAoConsumidor[];
  saidaMedicamentoTransferencia?: SaidaMedicamentoTransferencia[];
  saidaMedicamentoPerda?: SaidaMedicamentoPerda[];
}

export interface MensagemSNGPC {
  cabecalho: CabecalhoMovimentacao;
  corpo: {
    medicamentos: CorpoMedicamentos;
    insumos: Record<string, unknown>; // Simplificado - adicionar se necessário
  };
}

export interface MensagemSNGPCInventario {
  cabecalho: CabecalhoInventario;
  corpo: {
    medicamentos: {
      entradaMedicamentos?: Array<{
        medicamentoEntrada: MedicamentoEntrada;
      }>;
    };
    insumos: Record<string, unknown>;
  };
}

// ============================================================================
// FUNÇÕES DE GERAÇÃO XML
// ============================================================================

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '').padStart(14, '0');
}

function formatarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '').padStart(11, '0');
}

function gerarNotaFiscalXML(nf: NotaFiscal, tagName: string): string {
  return `
      <${tagName}>
        <numeroNotaFiscal>${nf.numeroNotaFiscal}</numeroNotaFiscal>
        <tipoOperacaoNotaFiscal>${nf.tipoOperacaoNotaFiscal}</tipoOperacaoNotaFiscal>
        <dataNotaFiscal>${nf.dataNotaFiscal}</dataNotaFiscal>
        <cnpjOrigem>${formatarCNPJ(nf.cnpjOrigem)}</cnpjOrigem>
        <cnpjDestino>${formatarCNPJ(nf.cnpjDestino)}</cnpjDestino>
      </${tagName}>`;
}

function gerarPrescritorXML(p: Prescritor): string {
  return `
        <prescritorMedicamento>
          <nomePrescritor>${escapeXml(p.nomePrescritor)}</nomePrescritor>
          <numeroRegistroProfissional>${escapeXml(p.numeroRegistroProfissional)}</numeroRegistroProfissional>
          <conselhoProfissional>${p.conselhoProfissional}</conselhoProfissional>
          <UFConselho>${p.UFConselho}</UFConselho>
        </prescritorMedicamento>`;
}

function gerarCompradorXML(c: Comprador): string {
  return `
        <compradorMedicamento>
          <nomeComprador>${escapeXml(c.nomeComprador)}</nomeComprador>
          <tipoDocumento>${c.tipoDocumento}</tipoDocumento>
          <numeroDocumento>${escapeXml(c.numeroDocumento)}</numeroDocumento>
          <orgaoExpedidor>${c.orgaoExpedidor}</orgaoExpedidor>
          <UFEmissaoDocumento>${c.UFEmissaoDocumento}</UFEmissaoDocumento>
        </compradorMedicamento>`;
}

function gerarEntradaMedicamentoXML(entrada: EntradaMedicamento): string {
  return `
      <entradaMedicamentos>${gerarNotaFiscalXML(entrada.notaFiscalEntradaMedicamento, 'notaFiscalEntradaMedicamento')}
        <medicamentoEntrada>
          <classeTerapeutica>${entrada.medicamentoEntrada.classeTerapeutica}</classeTerapeutica>
          <registroMSMedicamento>${entrada.medicamentoEntrada.registroMSMedicamento}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(entrada.medicamentoEntrada.numeroLoteMedicamento)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${entrada.medicamentoEntrada.quantidadeMedicamento}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>${entrada.medicamentoEntrada.unidadeMedidaMedicamento}</unidadeMedidaMedicamento>
        </medicamentoEntrada>
        <dataRecebimentoMedicamento>${entrada.dataRecebimentoMedicamento}</dataRecebimentoMedicamento>
      </entradaMedicamentos>`;
}

function gerarSaidaVendaXML(saida: SaidaMedicamentoVendaAoConsumidor): string {
  return `
      <saidaMedicamentoVendaAoConsumidor>
        <tipoReceituarioMedicamento>${saida.tipoReceituarioMedicamento}</tipoReceituarioMedicamento>
        <numeroNotificacaoMedicamento>${saida.numeroNotificacaoMedicamento || ''}</numeroNotificacaoMedicamento>
        <dataPrescricaoMedicamento>${saida.dataPrescricaoMedicamento}</dataPrescricaoMedicamento>${gerarPrescritorXML(saida.prescritorMedicamento)}
        <usoMedicamento>${saida.usoMedicamento}</usoMedicamento>${gerarCompradorXML(saida.compradorMedicamento)}
        <medicamentoVenda>
          <usoProlongado>${saida.medicamentoVenda.usoProlongado}</usoProlongado>
          <registroMSMedicamento>${saida.medicamentoVenda.registroMSMedicamento}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(saida.medicamentoVenda.numeroLoteMedicamento)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${saida.medicamentoVenda.quantidadeMedicamento}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>${saida.medicamentoVenda.unidadeMedidaMedicamento}</unidadeMedidaMedicamento>
        </medicamentoVenda>
        <dataVendaMedicamento>${saida.dataVendaMedicamento}</dataVendaMedicamento>
      </saidaMedicamentoVendaAoConsumidor>`;
}

function gerarSaidaTransferenciaXML(saida: SaidaMedicamentoTransferencia): string {
  return `
      <saidaMedicamentoTransferencia>${gerarNotaFiscalXML(saida.notaFiscalTransferenciaMedicamento, 'notaFiscalTransferenciaMedicamento')}
        <medicamentoTransferencia>
          <registroMSMedicamento>${saida.medicamentoTransferencia.registroMSMedicamento}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(saida.medicamentoTransferencia.numeroLoteMedicamento)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${saida.medicamentoTransferencia.quantidadeMedicamento}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>${saida.medicamentoTransferencia.unidadeMedidaMedicamento}</unidadeMedidaMedicamento>
        </medicamentoTransferencia>
        <dataTransferenciaMedicamento>${saida.dataTransferenciaMedicamento}</dataTransferenciaMedicamento>
      </saidaMedicamentoTransferencia>`;
}

function gerarSaidaPerdaXML(saida: SaidaMedicamentoPerda): string {
  return `
      <saidaMedicamentoPerda>
        <motivoPerda>${saida.motivoPerda}</motivoPerda>
        <medicamentoPerda>
          <registroMSMedicamento>${saida.medicamentoPerda.registroMSMedicamento}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(saida.medicamentoPerda.numeroLoteMedicamento)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${saida.medicamentoPerda.quantidadeMedicamento}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>${saida.medicamentoPerda.unidadeMedidaMedicamento}</unidadeMedidaMedicamento>
        </medicamentoPerda>
        <dataPerdaMedicamento>${saida.dataPerdaMedicamento}</dataPerdaMedicamento>
      </saidaMedicamentoPerda>`;
}

export function gerarMensagemSNGPCXML(mensagem: MensagemSNGPC): string {
  const { cabecalho, corpo } = mensagem;
  const meds = corpo.medicamentos;

  let medicamentosXml = '';

  if (meds.entradaMedicamentos?.length) {
    medicamentosXml += meds.entradaMedicamentos.map(gerarEntradaMedicamentoXML).join('');
  }
  if (meds.saidaMedicamentoVendaAoConsumidor?.length) {
    medicamentosXml += meds.saidaMedicamentoVendaAoConsumidor.map(gerarSaidaVendaXML).join('');
  }
  if (meds.saidaMedicamentoTransferencia?.length) {
    medicamentosXml += meds.saidaMedicamentoTransferencia.map(gerarSaidaTransferenciaXML).join('');
  }
  if (meds.saidaMedicamentoPerda?.length) {
    medicamentosXml += meds.saidaMedicamentoPerda.map(gerarSaidaPerdaXML).join('');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mensagemSNGPC xmlns="urn:sngpc-schema">
  <cabecalho>
    <cnpjEmissor>${formatarCNPJ(cabecalho.cnpjEmissor)}</cnpjEmissor>
    <cpfTransmissor>${formatarCPF(cabecalho.cpfTransmissor)}</cpfTransmissor>
    <dataInicio>${cabecalho.dataInicio}</dataInicio>
    <dataFim>${cabecalho.dataFim}</dataFim>
  </cabecalho>
  <corpo>
    <medicamentos>${medicamentosXml}
    </medicamentos>
    <insumos/>
  </corpo>
</mensagemSNGPC>`;
}

export function gerarMensagemInventarioXML(mensagem: MensagemSNGPCInventario): string {
  const { cabecalho, corpo } = mensagem;
  
  let medicamentosXml = '';
  if (corpo.medicamentos.entradaMedicamentos?.length) {
    medicamentosXml = corpo.medicamentos.entradaMedicamentos.map(e => `
      <entradaMedicamentos>
        <medicamentoEntrada>
          <classeTerapeutica>${e.medicamentoEntrada.classeTerapeutica}</classeTerapeutica>
          <registroMSMedicamento>${e.medicamentoEntrada.registroMSMedicamento}</registroMSMedicamento>
          <numeroLoteMedicamento>${escapeXml(e.medicamentoEntrada.numeroLoteMedicamento)}</numeroLoteMedicamento>
          <quantidadeMedicamento>${e.medicamentoEntrada.quantidadeMedicamento}</quantidadeMedicamento>
          <unidadeMedidaMedicamento>${e.medicamentoEntrada.unidadeMedidaMedicamento}</unidadeMedidaMedicamento>
        </medicamentoEntrada>
      </entradaMedicamentos>`).join('');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mensagemSNGPCInventario xmlns="urn:sngpc-schema">
  <cabecalho>
    <cnpjEmissor>${formatarCNPJ(cabecalho.cnpjEmissor)}</cnpjEmissor>
    <cpfTransmissor>${formatarCPF(cabecalho.cpfTransmissor)}</cpfTransmissor>
    <data>${cabecalho.data}</data>
  </cabecalho>
  <corpo>
    <medicamentos>${medicamentosXml}
    </medicamentos>
    <insumos/>
  </corpo>
</mensagemSNGPCInventario>`;
}

// ============================================================================
// MAPEAMENTO DE TIPOS RECEITUÁRIO
// ============================================================================

export const TIPO_RECEITUARIO_MAP: Record<string, TipoReceituario> = {
  'BRANCA_2VIAS': '1',     // Receita Controle Especial 2 vias
  'AZUL': '2',             // Notificação Receita B
  'BRANCA_ESPECIAL': '3',  // Notificação Receita Especial
  'AMARELA': '4',          // Notificação Receita A
  'ANTIMICROBIANO': '5',   // Receita Antimicrobiano
};

export const MOTIVO_PERDA_MAP: Record<string, TipoMotivoPerda> = {
  'FURTO_ROUBO': '1',
  'AVARIA': '2',
  'VENCIMENTO': '3',
  'APREENSAO_VISA': '4',
  'PERDA_PROCESSO': '5',
  'COLETA_QUALIDADE': '6',
  'EXCLUSAO_344': '7',
  'DESVIO_QUALIDADE': '8',
  'RECOLHIMENTO_FABRICANTE': '9',
  'DEVOLUCAO_FORNECEDOR': '10',
};

export const CONSELHO_MAP: Record<string, ConselhoProfissional> = {
  'CRM': 'CRM',
  'CRMV': 'CRMV',
  'CRO': 'CRO',
  'CRF': 'CRF',
  'RMS': 'RMS', // Programa Mais Médicos
};
