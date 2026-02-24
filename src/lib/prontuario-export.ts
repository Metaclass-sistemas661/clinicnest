// Serviço de Exportação de Prontuário (Portabilidade LGPD)
// Gera PDF + XML estruturado com todos os dados clínicos do paciente

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PatientData {
  id: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
}

export interface ProntuarioData {
  id: string;
  date: string;
  professional: string;
  specialty?: string;
  type: string;
  content: string;
  diagnosis?: string;
  cid?: string;
  signature?: string;
}

export interface ReceituarioData {
  id: string;
  date: string;
  professional: string;
  crm: string;
  medications: Array<{
    name: string;
    dosage: string;
    instructions: string;
    quantity: string;
  }>;
}

export interface AtestadoData {
  id: string;
  date: string;
  professional: string;
  crm: string;
  type: string;
  days?: number;
  content: string;
}

export interface LaudoData {
  id: string;
  date: string;
  professional: string;
  type: string;
  content: string;
  conclusion?: string;
}

export interface ExameData {
  id: string;
  date: string;
  type: string;
  result?: string;
  fileUrl?: string;
}

export interface ExportOptions {
  includeProntuarios: boolean;
  includeReceituarios: boolean;
  includeAtestados: boolean;
  includeLaudos: boolean;
  includeEvolucoes: boolean;
  includeExames: boolean;
  includeAnexos: boolean;
  dataInicio?: string;
  dataFim?: string;
}

export interface ExportData {
  patient: PatientData;
  prontuarios: ProntuarioData[];
  receituarios: ReceituarioData[];
  atestados: AtestadoData[];
  laudos: LaudoData[];
  exames: ExameData[];
  exportDate: string;
  exportedBy: string;
  clinicName: string;
  clinicCnpj?: string;
}

// Gerar XML estruturado (padrão HL7 CDA simplificado)
export function generateProntuarioXML(data: ExportData): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="BR"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <id root="${crypto.randomUUID()}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Resumo do Prontuário"/>
  <title>Exportação de Prontuário Médico</title>
  <effectiveTime value="${format(new Date(), 'yyyyMMddHHmmss')}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="pt-BR"/>
  
  <!-- Paciente -->
  <recordTarget>
    <patientRole>
      <id extension="${data.patient.cpf || ''}" root="2.16.840.1.113883.13.237"/>
      <patient>
        <name>${escapeXml(data.patient.name)}</name>
        ${data.patient.birthDate ? `<birthTime value="${data.patient.birthDate.replace(/-/g, '')}"/>` : ''}
      </patient>
    </patientRole>
  </recordTarget>
  
  <!-- Instituição -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <name>${escapeXml(data.clinicName)}</name>
        ${data.clinicCnpj ? `<id extension="${data.clinicCnpj}" root="2.16.840.1.113883.13.236"/>` : ''}
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  
  <!-- Data da exportação -->
  <documentationOf>
    <serviceEvent>
      <effectiveTime>
        <low value="${format(new Date(), 'yyyyMMddHHmmss')}"/>
      </effectiveTime>
    </serviceEvent>
  </documentationOf>
  
  <!-- Corpo do documento -->
  <component>
    <structuredBody>
      
      <!-- Prontuários -->
      ${data.prontuarios.length > 0 ? `
      <component>
        <section>
          <title>Prontuários</title>
          ${data.prontuarios.map(p => `
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <id root="${p.id}"/>
              <effectiveTime value="${p.date.replace(/-/g, '').replace(/:/g, '').replace('T', '')}"/>
              <performer>
                <assignedEntity>
                  <assignedPerson>
                    <name>${escapeXml(p.professional)}</name>
                  </assignedPerson>
                </assignedEntity>
              </performer>
              <entryRelationship typeCode="COMP">
                <observation classCode="OBS" moodCode="EVN">
                  <code code="type" displayName="${escapeXml(p.type)}"/>
                  <value xsi:type="ST">${escapeXml(p.content)}</value>
                  ${p.cid ? `<value xsi:type="CD" code="${p.cid}" codeSystem="2.16.840.1.113883.6.3" displayName="${escapeXml(p.diagnosis || '')}"/>` : ''}
                </observation>
              </entryRelationship>
            </act>
          </entry>
          `).join('')}
        </section>
      </component>
      ` : ''}
      
      <!-- Receituários -->
      ${data.receituarios.length > 0 ? `
      <component>
        <section>
          <title>Receituários</title>
          ${data.receituarios.map(r => `
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="RQO">
              <id root="${r.id}"/>
              <effectiveTime value="${r.date.replace(/-/g, '').replace(/:/g, '').replace('T', '')}"/>
              <author>
                <assignedAuthor>
                  <id extension="${r.crm}" root="2.16.840.1.113883.13.243"/>
                  <assignedPerson>
                    <name>${escapeXml(r.professional)}</name>
                  </assignedPerson>
                </assignedAuthor>
              </author>
              ${r.medications.map(m => `
              <consumable>
                <manufacturedProduct>
                  <manufacturedMaterial>
                    <name>${escapeXml(m.name)}</name>
                    <desc>${escapeXml(m.dosage)} - ${escapeXml(m.instructions)} - Qtd: ${escapeXml(m.quantity)}</desc>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
              `).join('')}
            </substanceAdministration>
          </entry>
          `).join('')}
        </section>
      </component>
      ` : ''}
      
      <!-- Atestados -->
      ${data.atestados.length > 0 ? `
      <component>
        <section>
          <title>Atestados</title>
          ${data.atestados.map(a => `
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <id root="${a.id}"/>
              <code code="atestado" displayName="${escapeXml(a.type)}"/>
              <effectiveTime value="${a.date.replace(/-/g, '').replace(/:/g, '').replace('T', '')}"/>
              <author>
                <assignedAuthor>
                  <id extension="${a.crm}" root="2.16.840.1.113883.13.243"/>
                  <assignedPerson>
                    <name>${escapeXml(a.professional)}</name>
                  </assignedPerson>
                </assignedAuthor>
              </author>
              <text>${escapeXml(a.content)}</text>
              ${a.days ? `<entryRelationship typeCode="COMP"><observation classCode="OBS" moodCode="EVN"><value xsi:type="INT" value="${a.days}"/></observation></entryRelationship>` : ''}
            </act>
          </entry>
          `).join('')}
        </section>
      </component>
      ` : ''}
      
      <!-- Laudos -->
      ${data.laudos.length > 0 ? `
      <component>
        <section>
          <title>Laudos</title>
          ${data.laudos.map(l => `
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <id root="${l.id}"/>
              <code code="laudo" displayName="${escapeXml(l.type)}"/>
              <effectiveTime value="${l.date.replace(/-/g, '').replace(/:/g, '').replace('T', '')}"/>
              <performer>
                <assignedEntity>
                  <assignedPerson>
                    <name>${escapeXml(l.professional)}</name>
                  </assignedPerson>
                </assignedEntity>
              </performer>
              <value xsi:type="ST">${escapeXml(l.content)}</value>
              ${l.conclusion ? `<interpretationCode><originalText>${escapeXml(l.conclusion)}</originalText></interpretationCode>` : ''}
            </observation>
          </entry>
          `).join('')}
        </section>
      </component>
      ` : ''}
      
      <!-- Exames -->
      ${data.exames.length > 0 ? `
      <component>
        <section>
          <title>Exames</title>
          ${data.exames.map(e => `
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <id root="${e.id}"/>
              <code code="exame" displayName="${escapeXml(e.type)}"/>
              <effectiveTime value="${e.date.replace(/-/g, '').replace(/:/g, '').replace('T', '')}"/>
              ${e.result ? `<value xsi:type="ST">${escapeXml(e.result)}</value>` : ''}
              ${e.fileUrl ? `<reference value="${escapeXml(e.fileUrl)}"/>` : ''}
            </observation>
          </entry>
          `).join('')}
        </section>
      </component>
      ` : ''}
      
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}

// Gerar HTML para PDF
export function generateProntuarioHTML(data: ExportData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Prontuário - ${data.patient.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; font-size: 24pt; margin-bottom: 5px; }
    .header p { color: #666; }
    .patient-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .patient-info h2 { color: #1e40af; font-size: 14pt; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .patient-info .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .patient-info .field { }
    .patient-info .label { font-weight: 600; color: #64748b; font-size: 9pt; text-transform: uppercase; }
    .patient-info .value { font-size: 11pt; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: #1e40af; font-size: 14pt; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .entry { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
    .entry-date { font-weight: 600; color: #2563eb; }
    .entry-professional { color: #64748b; font-size: 10pt; }
    .entry-content { white-space: pre-wrap; }
    .entry-meta { margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; font-size: 9pt; color: #94a3b8; }
    .medication { background: #f0fdf4; padding: 10px; border-radius: 4px; margin: 5px 0; }
    .medication-name { font-weight: 600; color: #166534; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9pt; color: #94a3b8; }
    .footer p { margin: 5px 0; }
    .hash { font-family: monospace; font-size: 8pt; word-break: break-all; }
    @media print { .container { max-width: 100%; } .entry { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.clinicName)}</h1>
      ${data.clinicCnpj ? `<p>CNPJ: ${data.clinicCnpj}</p>` : ''}
      <p>Exportação de Prontuário Médico</p>
    </div>
    
    <div class="patient-info">
      <h2>Dados do Paciente</h2>
      <div class="grid">
        <div class="field">
          <div class="label">Nome Completo</div>
          <div class="value">${escapeHtml(data.patient.name)}</div>
        </div>
        ${data.patient.cpf ? `
        <div class="field">
          <div class="label">CPF</div>
          <div class="value">${data.patient.cpf}</div>
        </div>
        ` : ''}
        ${data.patient.birthDate ? `
        <div class="field">
          <div class="label">Data de Nascimento</div>
          <div class="value">${format(new Date(data.patient.birthDate), 'dd/MM/yyyy', { locale: ptBR })}</div>
        </div>
        ` : ''}
        ${data.patient.email ? `
        <div class="field">
          <div class="label">E-mail</div>
          <div class="value">${escapeHtml(data.patient.email)}</div>
        </div>
        ` : ''}
      </div>
    </div>
    
    ${data.prontuarios.length > 0 ? `
    <div class="section">
      <h2>Prontuários (${data.prontuarios.length})</h2>
      ${data.prontuarios.map(p => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-date">${format(new Date(p.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          <span class="entry-professional">${escapeHtml(p.professional)}${p.specialty ? ` - ${escapeHtml(p.specialty)}` : ''}</span>
        </div>
        <div class="entry-content">${escapeHtml(p.content)}</div>
        ${p.cid ? `<div class="entry-meta">CID-10: ${p.cid}${p.diagnosis ? ` - ${escapeHtml(p.diagnosis)}` : ''}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.receituarios.length > 0 ? `
    <div class="section">
      <h2>Receituários (${data.receituarios.length})</h2>
      ${data.receituarios.map(r => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-date">${format(new Date(r.date), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span class="entry-professional">${escapeHtml(r.professional)} - CRM: ${r.crm}</span>
        </div>
        ${r.medications.map(m => `
        <div class="medication">
          <div class="medication-name">${escapeHtml(m.name)}</div>
          <div>${escapeHtml(m.dosage)} | ${escapeHtml(m.instructions)} | Quantidade: ${escapeHtml(m.quantity)}</div>
        </div>
        `).join('')}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.atestados.length > 0 ? `
    <div class="section">
      <h2>Atestados (${data.atestados.length})</h2>
      ${data.atestados.map(a => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-date">${format(new Date(a.date), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span class="entry-professional">${escapeHtml(a.professional)} - CRM: ${a.crm}</span>
        </div>
        <div class="entry-content">${escapeHtml(a.content)}</div>
        ${a.days ? `<div class="entry-meta">Dias de afastamento: ${a.days}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.laudos.length > 0 ? `
    <div class="section">
      <h2>Laudos (${data.laudos.length})</h2>
      ${data.laudos.map(l => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-date">${format(new Date(l.date), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span class="entry-professional">${escapeHtml(l.professional)}</span>
        </div>
        <div class="entry-content">${escapeHtml(l.content)}</div>
        ${l.conclusion ? `<div class="entry-meta"><strong>Conclusão:</strong> ${escapeHtml(l.conclusion)}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.exames.length > 0 ? `
    <div class="section">
      <h2>Exames (${data.exames.length})</h2>
      ${data.exames.map(e => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-date">${format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span class="entry-professional">${escapeHtml(e.type)}</span>
        </div>
        ${e.result ? `<div class="entry-content">${escapeHtml(e.result)}</div>` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
      <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
      <p>Exportado por: ${escapeHtml(data.exportedBy)}</p>
      <p>Este documento é uma cópia fiel dos registros médicos do paciente, conforme Art. 18 da LGPD (Lei 13.709/2018).</p>
    </div>
  </div>
</body>
</html>`;
}

// Escape XML
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Escape HTML
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
