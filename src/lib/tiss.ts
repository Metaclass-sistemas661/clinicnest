/**
 * Gerador de XML TISS 3.05.00 (ANS)
 * Referência: Padrão TISS - Troca de Informações em Saúde Suplementar
 *
 * Gera Guia de Consulta, SP/SADT e Honorários conforme schema ANS.
 * Hash do epílogo: MD5 hex do corpo XML (conforme especificação ANS).
 */

import * as forge from "node-forge";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TissGuiaConsulta {
  prestadorCnpj: string;
  prestadorCnes: string;
  prestadorNome: string;
  profissionalNome: string;
  profissionalCrm: string;
  profissionalConselho: string;
  profissionalUF: string;
  profissionalCBOS?: string;
  operadoraRegistroANS: string;
  beneficiarioNome: string;
  beneficiarioCarteirinha: string;
  beneficiarioCpf?: string;
  dataAtendimento: string;
  horaInicial?: string;
  numeroGuia: string;
  numeroPedido?: string;
  indicacaoAcidente: "0" | "1" | "2";
  tipoConsulta: "1" | "2" | "3";
  tussCode: string;
  procedimentoDescricao: string;
  valorProcedimento: number;
  valorTotal: number;
  observacao?: string;
  numLote: string;
  dataEnvio: string;
  tissVersion?: string;
}

export interface TissGuiaSPSADT {
  prestadorCnpj: string;
  prestadorCnes: string;
  prestadorNome: string;
  profissionalSolicitante: string;
  profissionalSolicitanteCRM: string;
  profissionalSolicitanteConselho: string;
  profissionalSolicitanteUF: string;
  profissionalSolicitanteCBOS?: string;
  profissionalExecutante?: string;
  profissionalExecutanteCRM?: string;
  profissionalExecutanteConselho?: string;
  profissionalExecutanteUF?: string;
  operadoraRegistroANS: string;
  beneficiarioNome: string;
  beneficiarioCarteirinha: string;
  beneficiarioCpf?: string;
  dataAtendimento: string;
  dataSolicitacao: string;
  numeroGuia: string;
  senhaAutorizacao?: string;
  indicacaoClinica?: string;
  caraterAtendimento: "1" | "2";
  tipoAtendimento: "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";
  indicacaoAcidente: "0" | "1" | "2";
  procedimentos: Array<{
    codigoTabela: string;
    codigoProcedimento: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    viaAcesso?: string;
    tecnicaUtilizada?: string;
  }>;
  observacao?: string;
  numLote: string;
  dataEnvio: string;
  tissVersion?: string;
}

export interface TissGuiaHonorarios {
  prestadorCnpj: string;
  prestadorCnes: string;
  prestadorNome: string;
  profissionalNome: string;
  profissionalCrm: string;
  profissionalConselho: string;
  profissionalUF: string;
  profissionalCBOS: string;
  grauParticipacao: "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10";
  operadoraRegistroANS: string;
  beneficiarioNome: string;
  beneficiarioCarteirinha: string;
  beneficiarioCpf?: string;
  dataAtendimento: string;
  dataInicioFaturamento: string;
  dataFimFaturamento: string;
  numeroGuia: string;
  numeroGuiaSolicitacao: string;
  senhaAutorizacao?: string;
  procedimentos: Array<{
    codigoTabela: string;
    codigoProcedimento: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  observacao?: string;
  numLote: string;
  dataEnvio: string;
  tissVersion?: string;
}

export interface TissRetornoGuia {
  numeroGuia: string;
  status: "accepted" | "rejected";
  motivoGlosa?: string;
  codigoGlosa?: string;
  valorGlosado?: number;
  valorLiberado?: number;
}

export interface TissRetornoLote {
  numeroLote: string;
  dataProcessamento: string;
  guias: TissRetornoGuia[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * Calcula hash MD5 hex do corpo XML conforme especificação ANS TISS.
 * A ANS exige que o conteúdo do <ans:epilogo><ans:hash> seja o MD5
 * hexadecimal do trecho entre <ans:prestadorParaOperadora> e
 * </ans:prestadorParaOperadora> (inclusive as tags).
 */
function computeTissHash(bodyXml: string): string {
  const md = forge.md.md5.create();
  md.update(bodyXml, "utf8");
  return md.digest().toHex();
}

const CBOS_DEFAULT = "225125"; // Médico Clínico Geral

function buildCabecalho(ver: string, cnpj: string, registroANS: string, now: Date): string {
  const sequential = pad(now.getTime() % 100000, 5);
  return `  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${sequential}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${formatDate(now)}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}</ans:horaRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        <ans:cnpjContratado>${escapeXml(cnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${escapeXml(registroANS)}</ans:registroANS>
    </ans:destino>
    <ans:Padrao>${ver}</ans:Padrao>
  </ans:cabecalho>`;
}

function wrapMensagemTISS(ver: string, cabecalho: string, body: string): string {
  const hash = computeTissHash(body);
  return `<?xml version="1.0" encoding="UTF-8"?>
<ans:mensagemTISS
  xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas/tissV${ver.replace(/\./g, "_")}.xsd">

${cabecalho}

${body}

  <ans:epilogo>
    <ans:hash>${hash}</ans:hash>
  </ans:epilogo>

</ans:mensagemTISS>`;
}

// ─── Guia de Consulta ────────────────────────────────────────────────────────

export function generateConsultaXML(g: TissGuiaConsulta): string {
  const ver = g.tissVersion ?? "3.05.00";
  const now = new Date();
  const cbos = g.profissionalCBOS || CBOS_DEFAULT;

  const cabecalho = buildCabecalho(ver, g.prestadorCnpj, g.operadoraRegistroANS, now);

  const body = `  <ans:prestadorParaOperadora>
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
              <ans:CBOS>${escapeXml(cbos)}</ans:CBOS>
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
  </ans:prestadorParaOperadora>`;

  return wrapMensagemTISS(ver, cabecalho, body);
}

// ─── Guia SP/SADT ────────────────────────────────────────────────────────────

export function generateSPSADTXML(g: TissGuiaSPSADT): string {
  const ver = g.tissVersion ?? "3.05.00";
  const now = new Date();
  const totalGeral = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);
  const cbos = g.profissionalSolicitanteCBOS || CBOS_DEFAULT;

  const cabecalho = buildCabecalho(ver, g.prestadorCnpj, g.operadoraRegistroANS, now);

  const procsXml = g.procedimentos
    .map(
      (p) => `              <ans:procedimentoRealizado>
                <ans:procedimento>
                  <ans:codigoTabela>${escapeXml(p.codigoTabela)}</ans:codigoTabela>
                  <ans:codigoProcedimento>${escapeXml(p.codigoProcedimento)}</ans:codigoProcedimento>
                  <ans:descricaoProcedimento>${escapeXml(p.descricao)}</ans:descricaoProcedimento>
                </ans:procedimento>
                <ans:quantidadeRealizada>${p.quantidade}</ans:quantidadeRealizada>
                ${p.viaAcesso ? `<ans:viaAcesso>${escapeXml(p.viaAcesso)}</ans:viaAcesso>` : ""}
                ${p.tecnicaUtilizada ? `<ans:tecnicaUtilizada>${escapeXml(p.tecnicaUtilizada)}</ans:tecnicaUtilizada>` : ""}
                <ans:valorUnitario>${formatMoney(p.valorUnitario)}</ans:valorUnitario>
                <ans:valorTotal>${formatMoney(p.valorTotal)}</ans:valorTotal>
              </ans:procedimentoRealizado>`
    )
    .join("\n");

  const body = `  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(g.numLote)}</ans:numeroLote>
      <ans:guiasTISS>
        <ans:guiaSP-SADT>
          <ans:cabecalhoGuia>
            <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
            <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuia)}</ans:numeroGuiaPrestador>
            ${g.senhaAutorizacao ? `<ans:guiaPrincipal>${escapeXml(g.senhaAutorizacao)}</ans:guiaPrincipal>` : ""}
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            <ans:numeroCarteira>${escapeXml(g.beneficiarioCarteirinha)}</ans:numeroCarteira>
            <ans:nomeBeneficiario>${escapeXml(g.beneficiarioNome)}</ans:nomeBeneficiario>
            ${g.beneficiarioCpf ? `<ans:cpf>${escapeXml(g.beneficiarioCpf.replace(/\D/g, ""))}</ans:cpf>` : ""}
          </ans:dadosBeneficiario>
          <ans:dadosSolicitacao>
            <ans:dataSolicitacao>${g.dataSolicitacao}</ans:dataSolicitacao>
            <ans:caraterAtendimento>${g.caraterAtendimento}</ans:caraterAtendimento>
            ${g.indicacaoClinica ? `<ans:indicacaoClinica>${escapeXml(g.indicacaoClinica)}</ans:indicacaoClinica>` : ""}
            <ans:contratadoSolicitante>
              <ans:cnpjContratado>${escapeXml(g.prestadorCnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
              <ans:nomeContratado>${escapeXml(g.prestadorNome)}</ans:nomeContratado>
            </ans:contratadoSolicitante>
            <ans:profissionalSolicitante>
              <ans:nomeProfissional>${escapeXml(g.profissionalSolicitante)}</ans:nomeProfissional>
              <ans:conselhoProfissional>${escapeXml(g.profissionalSolicitanteConselho)}</ans:conselhoProfissional>
              <ans:numeroConselhoProfissional>${escapeXml(g.profissionalSolicitanteCRM)}</ans:numeroConselhoProfissional>
              <ans:UF>${escapeXml(g.profissionalSolicitanteUF)}</ans:UF>
              <ans:CBOS>${escapeXml(cbos)}</ans:CBOS>
            </ans:profissionalSolicitante>
          </ans:dadosSolicitacao>
          <ans:dadosAtendimento>
            <ans:tipoAtendimento>${g.tipoAtendimento}</ans:tipoAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:tipoConsulta>1</ans:tipoConsulta>
          </ans:dadosAtendimento>
          <ans:procedimentosRealizados>
${procsXml}
          </ans:procedimentosRealizados>
          <ans:valorTotal>
            <ans:valorTotalGeral>${formatMoney(totalGeral)}</ans:valorTotalGeral>
          </ans:valorTotal>
          ${g.observacao ? `<ans:observacao>${escapeXml(g.observacao)}</ans:observacao>` : ""}
        </ans:guiaSP-SADT>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

  return wrapMensagemTISS(ver, cabecalho, body);
}

// ─── Guia de Honorários ──────────────────────────────────────────────────────

export function generateHonorariosXML(g: TissGuiaHonorarios): string {
  const ver = g.tissVersion ?? "3.05.00";
  const now = new Date();
  const totalGeral = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);

  const cabecalho = buildCabecalho(ver, g.prestadorCnpj, g.operadoraRegistroANS, now);

  const procsXml = g.procedimentos
    .map(
      (p) => `              <ans:procedimentoRealizado>
                <ans:procedimento>
                  <ans:codigoTabela>${escapeXml(p.codigoTabela)}</ans:codigoTabela>
                  <ans:codigoProcedimento>${escapeXml(p.codigoProcedimento)}</ans:codigoProcedimento>
                  <ans:descricaoProcedimento>${escapeXml(p.descricao)}</ans:descricaoProcedimento>
                </ans:procedimento>
                <ans:quantidadeRealizada>${p.quantidade}</ans:quantidadeRealizada>
                <ans:valorUnitario>${formatMoney(p.valorUnitario)}</ans:valorUnitario>
                <ans:valorTotal>${formatMoney(p.valorTotal)}</ans:valorTotal>
              </ans:procedimentoRealizado>`
    )
    .join("\n");

  const body = `  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(g.numLote)}</ans:numeroLote>
      <ans:guiasTISS>
        <ans:guiaHonorarios>
          <ans:cabecalhoGuia>
            <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
            <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuia)}</ans:numeroGuiaPrestador>
            <ans:numeroGuiaSolicitacao>${escapeXml(g.numeroGuiaSolicitacao)}</ans:numeroGuiaSolicitacao>
            ${g.senhaAutorizacao ? `<ans:senhaAutorizacao>${escapeXml(g.senhaAutorizacao)}</ans:senhaAutorizacao>` : ""}
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            <ans:numeroCarteira>${escapeXml(g.beneficiarioCarteirinha)}</ans:numeroCarteira>
            <ans:nomeBeneficiario>${escapeXml(g.beneficiarioNome)}</ans:nomeBeneficiario>
            ${g.beneficiarioCpf ? `<ans:cpf>${escapeXml(g.beneficiarioCpf.replace(/\D/g, ""))}</ans:cpf>` : ""}
          </ans:dadosBeneficiario>
          <ans:dadosContratadoExecutante>
            <ans:cnpjContratado>${escapeXml(g.prestadorCnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
            <ans:nomeContratado>${escapeXml(g.prestadorNome)}</ans:nomeContratado>
            <ans:cnesOperador>${escapeXml(g.prestadorCnes)}</ans:cnesOperador>
          </ans:dadosContratadoExecutante>
          <ans:dadosProfissionalExecutante>
            <ans:nomeProfissional>${escapeXml(g.profissionalNome)}</ans:nomeProfissional>
            <ans:conselhoProfissional>${escapeXml(g.profissionalConselho)}</ans:conselhoProfissional>
            <ans:numeroConselhoProfissional>${escapeXml(g.profissionalCrm)}</ans:numeroConselhoProfissional>
            <ans:UF>${escapeXml(g.profissionalUF)}</ans:UF>
            <ans:CBOS>${escapeXml(g.profissionalCBOS)}</ans:CBOS>
          </ans:dadosProfissionalExecutante>
          <ans:grauParticipacao>${g.grauParticipacao}</ans:grauParticipacao>
          <ans:dadosAtendimento>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:dataInicioFaturamento>${g.dataInicioFaturamento}</ans:dataInicioFaturamento>
            <ans:dataFimFaturamento>${g.dataFimFaturamento}</ans:dataFimFaturamento>
          </ans:dadosAtendimento>
          <ans:procedimentosRealizados>
${procsXml}
          </ans:procedimentosRealizados>
          <ans:valorTotal>
            <ans:valorTotalGeral>${formatMoney(totalGeral)}</ans:valorTotalGeral>
          </ans:valorTotal>
          ${g.observacao ? `<ans:observacao>${escapeXml(g.observacao)}</ans:observacao>` : ""}
        </ans:guiaHonorarios>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

  return wrapMensagemTISS(ver, cabecalho, body);
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

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

export function generateLotNumber(sequence: number): string {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${date}${pad(sequence, 4)}`;
}

// ─── Parser de XML de Retorno da Operadora ──────────────────────────────────

export function parseRetornoXML(xmlString: string): TissRetornoLote | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) return null;

    const getText = (parent: Element, tagSuffix: string): string =>
      parent.querySelector(`*|${tagSuffix}`)?.textContent?.trim() ?? "";

    const loteNode =
      doc.querySelector("*|operadoraParaPrestadora *|reciboCobranca") ??
      doc.querySelector("*|operadoraParaPrestador *|reciboCobranca") ??
      doc.documentElement;

    const numeroLote = getText(loteNode, "numeroLote") || getText(doc.documentElement, "numeroLote");
    const dataProcessamento =
      getText(loteNode, "dataProcessamento") ||
      getText(doc.documentElement, "dataRegistroTransacao") ||
      new Date().toISOString().slice(0, 10);

    const guias: TissRetornoGuia[] = [];
    const guiaNodes = doc.querySelectorAll(
      "*|guiaRecursoGlosa, *|guiaConsulta, *|guiaSP-SADT, *|guiaHonorarios, *|detalheGuia"
    );

    guiaNodes.forEach((guiaNode) => {
      const numGuia =
        getText(guiaNode as Element, "numeroGuiaPrestador") ||
        getText(guiaNode as Element, "numeroGuiaOperadora");
      if (!numGuia) return;

      const codigoGlosa = getText(guiaNode as Element, "codigoGlosa");
      const motivoGlosa = getText(guiaNode as Element, "descricaoGlosa") || getText(guiaNode as Element, "motivoGlosa");
      const valorGlosadoStr = getText(guiaNode as Element, "valorGlosa") || getText(guiaNode as Element, "valorGlosado");
      const valorLiberadoStr = getText(guiaNode as Element, "valorLiberado") || getText(guiaNode as Element, "valorInformado");

      const isGlosa = !!codigoGlosa || !!motivoGlosa || (!!valorGlosadoStr && parseFloat(valorGlosadoStr) > 0);

      guias.push({
        numeroGuia: numGuia,
        status: isGlosa ? "rejected" : "accepted",
        codigoGlosa: codigoGlosa || undefined,
        motivoGlosa: motivoGlosa || undefined,
        valorGlosado: valorGlosadoStr ? parseFloat(valorGlosadoStr) : undefined,
        valorLiberado: valorLiberadoStr ? parseFloat(valorLiberadoStr) : undefined,
      });
    });

    if (guias.length === 0) {
      const allGuiaHeaders = doc.querySelectorAll("*|numeroGuiaPrestador");
      allGuiaHeaders.forEach((el) => {
        const num = el.textContent?.trim();
        if (num) {
          guias.push({ numeroGuia: num, status: "accepted" });
        }
      });
    }

    return { numeroLote, dataProcessamento, guias };
  } catch {
    return null;
  }
}
