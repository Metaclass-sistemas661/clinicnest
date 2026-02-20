/**
 * Gerador de XML TISS 3.05.00 (ANS)
 * Referência: Padrão TISS - Troca de Informações em Saúde Suplementar
 *
 * Gera Guia de Consulta (guiaConsulta) conforme schema ANS.
 */

export interface TissGuiaConsulta {
  // Dados do prestador (clínica)
  prestadorCnpj: string;
  prestadorCnes: string;
  prestadorNome: string;
  // Profissional responsável
  profissionalNome: string;
  profissionalCrm: string;
  profissionalConselho: string; // CRM | CRO | CRN etc.
  profissionalUF: string;
  // Dados da operadora
  operadoraRegistroANS: string; // ANS code da operadora (6 dígitos)
  // Dados do beneficiário (paciente)
  beneficiarioNome: string;
  beneficiarioCarteirinha: string;
  beneficiarioCpf?: string;
  // Dados do atendimento
  dataAtendimento: string; // YYYY-MM-DD
  horaInicial?: string;   // HH:MM
  numeroGuia: string;
  numeroPedido?: string;
  indicacaoAcidente: "0" | "1" | "2"; // 0=não acidente, 1=acidente, 2=doença ocupacional
  tipoConsulta: "1" | "2" | "3"; // 1=normal, 2=retorno, 3=pré-natal
  tussCode: string;
  procedimentoDescricao: string;
  valorProcedimento: number;
  valorTotal: number;
  observacao?: string;
  // Metadados TISS
  numLote: string;
  dataEnvio: string; // YYYY-MM-DD
  tissVersion?: string;
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMoney(v: number): string {
  return v.toFixed(2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Gera XML TISS para Guia de Consulta.
 * O XML resultante pode ser salvo e enviado à operadora de saúde.
 */
export function generateConsultaXML(g: TissGuiaConsulta): string {
  const ver = g.tissVersion ?? "3.05.00";
  const now = new Date();
  const sequential = pad(now.getTime() % 100000, 5);

  return `<?xml version="1.0" encoding="UTF-8"?>
<ans:mensagemTISS
  xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas/tissV${ver.replace(/\./g, "_")}.xsd">

  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${sequential}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${formatDate(now)}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}</ans:horaRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        <ans:cnpjContratado>${escapeXml(g.prestadorCnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
    </ans:destino>
    <ans:Padrao>${ver}</ans:Padrao>
  </ans:cabecalho>

  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(g.numLote)}</ans:numeroLote>
      <ans:guiasTISS>
        <ans:guiaConsulta>
          <ans:cabecalhoGuia>
            <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
            <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuia)}</ans:numeroGuiaPrestador>
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            <ans:numeroCarteira>${escapeXml(g.beneficiarioCarteirinha)}</ans:numeroCarteira>
            <ans:nomeBeneficiario>${escapeXml(g.beneficiarioNome)}</ans:nomeBeneficiario>
            ${g.beneficiarioCpf ? `<ans:cpf>${escapeXml(g.beneficiarioCpf.replace(/\D/g, ""))}</ans:cpf>` : ""}
          </ans:dadosBeneficiario>
          <ans:dadosSolicitante>
            <ans:contratadoSolicitante>
              <ans:cnpjContratado>${escapeXml(g.prestadorCnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
              <ans:nomeContratado>${escapeXml(g.prestadorNome)}</ans:nomeContratado>
              <ans:cnesOperador>${escapeXml(g.prestadorCnes)}</ans:cnesOperador>
            </ans:contratadoSolicitante>
            <ans:profissionalSolicitante>
              <ans:nomeProfissional>${escapeXml(g.profissionalNome)}</ans:nomeProfissional>
              <ans:conselhoProfissional>${escapeXml(g.profissionalConselho)}</ans:conselhoProfissional>
              <ans:numeroConselhoProfissional>${escapeXml(g.profissionalCrm)}</ans:numeroConselhoProfissional>
              <ans:UF>${escapeXml(g.profissionalUF)}</ans:UF>
              <ans:CBOS>225125</ans:CBOS>
            </ans:profissionalSolicitante>
          </ans:dadosSolicitante>
          <ans:dadosAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            ${g.horaInicial ? `<ans:horaInicial>${g.horaInicial}</ans:horaInicial>` : ""}
            <ans:tipoConsulta>${g.tipoConsulta}</ans:tipoConsulta>
            <ans:procedimentosRealizados>
              <ans:procedimento>
                <ans:codigoTabela>22</ans:codigoTabela>
                <ans:codigoProcedimento>${escapeXml(g.tussCode)}</ans:codigoProcedimento>
                <ans:descricaoProcedimento>${escapeXml(g.procedimentoDescricao)}</ans:descricaoProcedimento>
                <ans:quantidadeRealizada>1</ans:quantidadeRealizada>
                <ans:valorUnitario>${formatMoney(g.valorProcedimento)}</ans:valorUnitario>
                <ans:valorTotal>${formatMoney(g.valorTotal)}</ans:valorTotal>
              </ans:procedimento>
            </ans:procedimentosRealizados>
          </ans:dadosAtendimento>
          <ans:valorTotal>
            <ans:valorTotalGeral>${formatMoney(g.valorTotal)}</ans:valorTotalGeral>
          </ans:valorTotal>
          ${g.observacao ? `<ans:observacao>${escapeXml(g.observacao)}</ans:observacao>` : ""}
        </ans:guiaConsulta>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>

  <ans:epilogo>
    <ans:hash>${btoa(`${g.numLote}-${g.numeroGuia}-${g.valorTotal}`).substring(0, 32)}</ans:hash>
  </ans:epilogo>

</ans:mensagemTISS>`;
}

/**
 * Baixa o XML como arquivo.
 */
export function downloadTissXml(xml: string, fileName: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gera número de lote automático: YYYYMMDD + sequencial
 */
export function generateLotNumber(sequence: number): string {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${date}${pad(sequence, 4)}`;
}
