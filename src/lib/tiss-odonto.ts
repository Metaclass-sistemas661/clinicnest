/**
 * Gerador de XML TISS 3.05.00 — Guia de Tratamento Odontológico (GTO)
 * Referência: Padrão TISS ANS - Anexo específico odontológico
 */

import * as forge from "node-forge";

// ─── Interfaces GTO ─────────────────────────────────────────────────────────

export interface TissGuiaOdonto {
  prestadorCnpj: string;
  prestadorCnes: string;
  prestadorNome: string;
  profissionalNome: string;
  profissionalCro: string;
  profissionalUF: string;
  profissionalCBOS?: string;
  operadoraRegistroANS: string;
  beneficiarioNome: string;
  beneficiarioCarteirinha: string;
  beneficiarioCpf?: string;
  dataAtendimento: string;
  numeroGuia: string;
  senhaAutorizacao?: string;
  indicacaoAcidente: "0" | "1" | "2";
  procedimentos: TissProcedimentoOdonto[];
  observacao?: string;
  numLote: string;
  tissVersion?: string;
}

export interface TissProcedimentoOdonto {
  codigoProcedimento: string;
  descricao: string;
  dente?: number;
  regiao?: string;
  face?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface TissLoteOdonto {
  guias: TissGuiaOdonto[];
  numLote: string;
  dataEnvio: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(n: number, len = 2): string {
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

function computeTissHash(bodyXml: string): string {
  const md = forge.md.md5.create();
  md.update(bodyXml, "utf8");
  return md.digest().toHex();
}

const CBOS_DENTISTA = "223204";

// ─── Gerador GTO ────────────────────────────────────────────────────────────

export function generateGTOXML(g: TissGuiaOdonto): string {
  const ver = g.tissVersion ?? "3.05.00";
  const now = new Date();
  const cbos = g.profissionalCBOS || CBOS_DENTISTA;
  const totalGeral = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);
  const sequential = pad(now.getTime() % 100000, 5);

  const cabecalho = `  <ans:cabecalho>
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
  </ans:cabecalho>`;

  const procsXml = g.procedimentos.map((p) => buildProcedimentoOdontoXml(p)).join("\n");

  const body = `  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(g.numLote)}</ans:numeroLote>
      <ans:guiasTISS>
        <ans:guiaTratamentoOdontologico>
          <ans:cabecalhoGuia>
            <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
            <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuia)}</ans:numeroGuiaPrestador>
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
            <ans:cnes>${escapeXml(g.prestadorCnes)}</ans:cnes>
          </ans:dadosContratadoExecutante>
          <ans:profissionalExecutante>
            <ans:nomeProfissional>${escapeXml(g.profissionalNome)}</ans:nomeProfissional>
            <ans:conselhoProfissional>CRO</ans:conselhoProfissional>
            <ans:numeroConselhoProfissional>${escapeXml(g.profissionalCro)}</ans:numeroConselhoProfissional>
            <ans:UF>${escapeXml(g.profissionalUF)}</ans:UF>
            <ans:CBOS>${escapeXml(cbos)}</ans:CBOS>
          </ans:profissionalExecutante>
          <ans:dadosAtendimento>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
          </ans:dadosAtendimento>
          <ans:procedimentosRealizados>
${procsXml}
          </ans:procedimentosRealizados>
          <ans:valorTotal>
            <ans:valorTotalGeral>${formatMoney(totalGeral)}</ans:valorTotalGeral>
          </ans:valorTotal>
          ${g.observacao ? `<ans:observacao>${escapeXml(g.observacao)}</ans:observacao>` : ""}
        </ans:guiaTratamentoOdontologico>
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

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

function buildProcedimentoOdontoXml(p: TissProcedimentoOdonto): string {
  return `            <ans:procedimentoRealizado>
              <ans:procedimento>
                <ans:codigoTabela>98</ans:codigoTabela>
                <ans:codigoProcedimento>${escapeXml(p.codigoProcedimento)}</ans:codigoProcedimento>
                <ans:descricaoProcedimento>${escapeXml(p.descricao)}</ans:descricaoProcedimento>
              </ans:procedimento>
              ${p.dente ? `<ans:dente>${p.dente}</ans:dente>` : ""}
              ${p.regiao ? `<ans:regiao>${escapeXml(p.regiao)}</ans:regiao>` : ""}
              ${p.face ? `<ans:face>${escapeXml(p.face)}</ans:face>` : ""}
              <ans:quantidadeRealizada>${p.quantidade}</ans:quantidadeRealizada>
              <ans:valorUnitario>${formatMoney(p.valorUnitario)}</ans:valorUnitario>
              <ans:valorTotal>${formatMoney(p.valorTotal)}</ans:valorTotal>
            </ans:procedimentoRealizado>`;
}

// ─── Gerador de Lote ────────────────────────────────────────────────────────

export function generateLoteGTOXML(lote: TissLoteOdonto): string {
  if (lote.guias.length === 0) return "";
  
  const firstGuia = lote.guias[0];
  const ver = firstGuia.tissVersion ?? "3.05.00";
  const now = new Date();
  const sequential = pad(now.getTime() % 100000, 5);

  const cabecalho = `  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${sequential}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${lote.dataEnvio}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}</ans:horaRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        <ans:cnpjContratado>${escapeXml(firstGuia.prestadorCnpj.replace(/\D/g, ""))}</ans:cnpjContratado>
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${escapeXml(firstGuia.operadoraRegistroANS)}</ans:registroANS>
    </ans:destino>
    <ans:Padrao>${ver}</ans:Padrao>
  </ans:cabecalho>`;

  const guiasXml = lote.guias.map((g) => buildGuiaGTOXml(g)).join("\n");

  const body = `  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(lote.numLote)}</ans:numeroLote>
      <ans:guiasTISS>
${guiasXml}
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

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

function buildGuiaGTOXml(g: TissGuiaOdonto): string {
  const cbos = g.profissionalCBOS || CBOS_DENTISTA;
  const totalGeral = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);
  const procsXml = g.procedimentos.map((p) => buildProcedimentoOdontoXml(p)).join("\n");

  return `        <ans:guiaTratamentoOdontologico>
          <ans:cabecalhoGuia>
            <ans:registroANS>${escapeXml(g.operadoraRegistroANS)}</ans:registroANS>
            <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuia)}</ans:numeroGuiaPrestador>
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
            <ans:cnes>${escapeXml(g.prestadorCnes)}</ans:cnes>
          </ans:dadosContratadoExecutante>
          <ans:profissionalExecutante>
            <ans:nomeProfissional>${escapeXml(g.profissionalNome)}</ans:nomeProfissional>
            <ans:conselhoProfissional>CRO</ans:conselhoProfissional>
            <ans:numeroConselhoProfissional>${escapeXml(g.profissionalCro)}</ans:numeroConselhoProfissional>
            <ans:UF>${escapeXml(g.profissionalUF)}</ans:UF>
            <ans:CBOS>${escapeXml(cbos)}</ans:CBOS>
          </ans:profissionalExecutante>
          <ans:dadosAtendimento>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
          </ans:dadosAtendimento>
          <ans:procedimentosRealizados>
${procsXml}
          </ans:procedimentosRealizados>
          <ans:valorTotal>
            <ans:valorTotalGeral>${formatMoney(totalGeral)}</ans:valorTotalGeral>
          </ans:valorTotal>
          ${g.observacao ? `<ans:observacao>${escapeXml(g.observacao)}</ans:observacao>` : ""}
        </ans:guiaTratamentoOdontologico>`;
}

// ─── Parser de Retorno Odonto ───────────────────────────────────────────────

export interface TissRetornoOdonto {
  numeroLote: string;
  dataProcessamento: string;
  guias: TissRetornoGuiaOdonto[];
}

export interface TissRetornoGuiaOdonto {
  numeroGuia: string;
  status: "accepted" | "rejected" | "partial";
  procedimentos: TissRetornoProcOdonto[];
  valorTotal?: number;
  valorGlosado?: number;
  valorLiberado?: number;
}

export interface TissRetornoProcOdonto {
  codigoProcedimento: string;
  dente?: number;
  face?: string;
  status: "accepted" | "rejected";
  codigoGlosa?: string;
  motivoGlosa?: string;
  valorGlosado?: number;
}

export function parseRetornoOdontoXML(xmlString: string): TissRetornoOdonto | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    if (doc.querySelector("parsererror")) return null;

    const getText = (parent: Element, tag: string): string =>
      parent.querySelector(`*|${tag}`)?.textContent?.trim() ?? "";

    const numeroLote = getText(doc.documentElement, "numeroLote");
    const dataProcessamento = getText(doc.documentElement, "dataProcessamento") || new Date().toISOString().slice(0, 10);

    const guias: TissRetornoGuiaOdonto[] = [];
    const guiaNodes = doc.querySelectorAll("*|guiaTratamentoOdontologico, *|detalheGuia");

    guiaNodes.forEach((guiaNode) => {
      const el = guiaNode as Element;
      const numGuia = getText(el, "numeroGuiaPrestador") || getText(el, "numeroGuiaOperadora");
      if (!numGuia) return;

      const procedimentos: TissRetornoProcOdonto[] = [];
      const procNodes = el.querySelectorAll("*|procedimentoRealizado, *|detalheProcedimento");

      procNodes.forEach((procNode) => {
        const pEl = procNode as Element;
        const codigo = getText(pEl, "codigoProcedimento");
        const denteStr = getText(pEl, "dente");
        const face = getText(pEl, "face");
        const codigoGlosa = getText(pEl, "codigoGlosa");
        const motivoGlosa = getText(pEl, "descricaoGlosa") || getText(pEl, "motivoGlosa");
        const valorGlosadoStr = getText(pEl, "valorGlosa");

        procedimentos.push({
          codigoProcedimento: codigo,
          dente: denteStr ? parseInt(denteStr) : undefined,
          face: face || undefined,
          status: codigoGlosa || motivoGlosa ? "rejected" : "accepted",
          codigoGlosa: codigoGlosa || undefined,
          motivoGlosa: motivoGlosa || undefined,
          valorGlosado: valorGlosadoStr ? parseFloat(valorGlosadoStr) : undefined,
        });
      });

      const valorTotalStr = getText(el, "valorTotalGeral") || getText(el, "valorInformado");
      const valorGlosadoStr = getText(el, "valorGlosado") || getText(el, "valorGlosa");
      const valorLiberadoStr = getText(el, "valorLiberado");

      const hasGlosa = procedimentos.some((p) => p.status === "rejected");
      const allGlosa = procedimentos.length > 0 && procedimentos.every((p) => p.status === "rejected");

      guias.push({
        numeroGuia: numGuia,
        status: allGlosa ? "rejected" : hasGlosa ? "partial" : "accepted",
        procedimentos,
        valorTotal: valorTotalStr ? parseFloat(valorTotalStr) : undefined,
        valorGlosado: valorGlosadoStr ? parseFloat(valorGlosadoStr) : undefined,
        valorLiberado: valorLiberadoStr ? parseFloat(valorLiberadoStr) : undefined,
      });
    });

    return { numeroLote, dataProcessamento, guias };
  } catch {
    return null;
  }
}

// ─── Utilitários ────────────────────────────────────────────────────────────

export function downloadGTOXml(xml: string, fileName: string) {
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

export const FACES_ODONTO = {
  V: "Vestibular",
  L: "Lingual",
  P: "Palatina",
  M: "Mesial",
  D: "Distal",
  O: "Oclusal",
  I: "Incisal",
  C: "Cervical",
} as const;

export const REGIOES_ODONTO = {
  "01": "Arcada superior",
  "02": "Arcada inferior",
  "03": "Boca toda",
  "04": "Quadrante superior direito",
  "05": "Quadrante superior esquerdo",
  "06": "Quadrante inferior direito",
  "07": "Quadrante inferior esquerdo",
  "08": "Sextante 1",
  "09": "Sextante 2",
  "10": "Sextante 3",
  "11": "Sextante 4",
  "12": "Sextante 5",
  "13": "Sextante 6",
} as const;
