/**
 * HL7 v2.x Parser — Integração com Laboratórios
 * 
 * Parser completo para mensagens HL7 v2.x (2.3, 2.4, 2.5, 2.5.1)
 * Foco em mensagens ORU^R01 (resultados de exames) e ORM^O01 (pedidos)
 * 
 * Referência: HL7 International - https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185
 */

// ─── Constantes HL7 ───────────────────────────────────────────────────────────

export const HL7_DELIMITERS = {
  FIELD: '|',
  COMPONENT: '^',
  REPETITION: '~',
  ESCAPE: '\\',
  SUBCOMPONENT: '&',
} as const;

export const HL7_MESSAGE_TYPES = {
  ORU_R01: 'ORU^R01', // Resultado de exame (unsolicited)
  ORM_O01: 'ORM^O01', // Pedido de exame
  ADT_A01: 'ADT^A01', // Admissão
  ADT_A08: 'ADT^A08', // Atualização de paciente
  ACK: 'ACK',         // Acknowledgment
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface HL7Message {
  raw: string;
  segments: HL7Segment[];
  messageType: string;
  messageControlId: string;
  version: string;
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  dateTime: string;
}

export interface HL7Segment {
  name: string;
  fields: HL7Field[];
  raw: string;
}

export interface HL7Field {
  value: string;
  components: string[];
  repetitions: string[];
}

export interface HL7Patient {
  id: string;
  externalId?: string;
  name: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O' | 'U';
  cpf?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface HL7Order {
  id: string;
  placerOrderNumber: string;
  fillerOrderNumber?: string;
  orderDateTime: string;
  status: 'SC' | 'IP' | 'CM' | 'CA' | 'HD'; // Scheduled, In Progress, Complete, Cancelled, Hold
  priority: 'S' | 'A' | 'R' | 'P' | 'T'; // Stat, ASAP, Routine, Preop, Timing critical
  tests: HL7Test[];
}

export interface HL7Test {
  code: string;
  name: string;
  codingSystem?: string;
}

export interface HL7Result {
  orderId: string;
  observationId: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  abnormalFlag?: 'L' | 'H' | 'LL' | 'HH' | 'N' | 'A' | 'AA';
  status: 'F' | 'P' | 'C' | 'X'; // Final, Preliminary, Corrected, Cancelled
  observationDateTime: string;
  performingLab?: string;
  comments?: string[];
}

export interface HL7ParsedLabResult {
  message: HL7Message;
  patient: HL7Patient;
  order?: HL7Order;
  results: HL7Result[];
  errors: string[];
}

// ─── Parser Principal ─────────────────────────────────────────────────────────

export function parseHL7Message(raw: string): HL7Message {
  const lines = raw.trim().split(/\r?\n|\r/);
  const segments: HL7Segment[] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      segments.push(parseSegment(line));
    }
  }
  
  const msh = segments.find(s => s.name === 'MSH');
  if (!msh) {
    throw new Error('Mensagem HL7 inválida: segmento MSH não encontrado');
  }
  
  return {
    raw,
    segments,
    messageType: getFieldValue(msh, 8),
    messageControlId: getFieldValue(msh, 9),
    version: getFieldValue(msh, 11),
    sendingApplication: getFieldValue(msh, 2),
    sendingFacility: getFieldValue(msh, 3),
    receivingApplication: getFieldValue(msh, 4),
    receivingFacility: getFieldValue(msh, 5),
    dateTime: getFieldValue(msh, 6),
  };
}

function parseSegment(line: string): HL7Segment {
  const name = line.substring(0, 3);
  const rest = line.substring(4);
  
  // MSH é especial - o primeiro campo é o delimitador
  if (name === 'MSH') {
    const fields: HL7Field[] = [
      { value: '|', components: ['|'], repetitions: ['|'] },
      { value: rest.substring(0, 4), components: [rest.substring(0, 4)], repetitions: [rest.substring(0, 4)] },
    ];
    
    const remaining = rest.substring(5).split(HL7_DELIMITERS.FIELD);
    for (const f of remaining) {
      fields.push(parseField(f));
    }
    
    return { name, fields, raw: line };
  }
  
  const fieldValues = rest.split(HL7_DELIMITERS.FIELD);
  const fields = fieldValues.map(parseField);
  
  return { name, fields, raw: line };
}

function parseField(value: string): HL7Field {
  const repetitions = value.split(HL7_DELIMITERS.REPETITION);
  const components = value.split(HL7_DELIMITERS.COMPONENT);
  
  return { value, components, repetitions };
}

function getFieldValue(segment: HL7Segment, index: number): string {
  return segment.fields[index]?.value ?? '';
}

function getComponent(segment: HL7Segment, fieldIndex: number, componentIndex: number): string {
  return segment.fields[fieldIndex]?.components[componentIndex] ?? '';
}

// ─── Parser de Resultados de Laboratório (ORU^R01) ────────────────────────────

export function parseLabResult(raw: string): HL7ParsedLabResult {
  const errors: string[] = [];
  let message: HL7Message;
  
  try {
    message = parseHL7Message(raw);
  } catch (e) {
    return {
      message: { raw, segments: [], messageType: '', messageControlId: '', version: '', dateTime: '' },
      patient: { id: '', name: '' },
      results: [],
      errors: [`Erro ao parsear mensagem: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  
  // Parse Patient (PID segment)
  const pid = message.segments.find(s => s.name === 'PID');
  const patient = parsePatientSegment(pid);
  
  if (!patient.id && !patient.name) {
    errors.push('Segmento PID não encontrado ou inválido');
  }
  
  // Parse Order (ORC/OBR segments)
  const orc = message.segments.find(s => s.name === 'ORC');
  const obr = message.segments.find(s => s.name === 'OBR');
  const order = parseOrderSegments(orc, obr);
  
  // Parse Results (OBX segments)
  const obxSegments = message.segments.filter(s => s.name === 'OBX');
  const results = obxSegments.map(obx => parseResultSegment(obx, order?.id));
  
  if (results.length === 0) {
    errors.push('Nenhum resultado (OBX) encontrado na mensagem');
  }
  
  return { message, patient, order, results, errors };
}

function parsePatientSegment(pid?: HL7Segment): HL7Patient {
  if (!pid) {
    return { id: '', name: '' };
  }
  
  // PID-3: Patient ID List
  const patientId = getComponent(pid, 3, 0);
  
  // PID-5: Patient Name (Family^Given^Middle^Suffix^Prefix)
  const familyName = getComponent(pid, 5, 0);
  const givenName = getComponent(pid, 5, 1);
  const middleName = getComponent(pid, 5, 2);
  const fullName = [givenName, middleName, familyName].filter(Boolean).join(' ');
  
  // PID-7: Date of Birth (YYYYMMDD)
  const dob = getFieldValue(pid, 7);
  const birthDate = dob ? formatHL7Date(dob) : undefined;
  
  // PID-8: Sex
  const sex = getFieldValue(pid, 8) as 'M' | 'F' | 'O' | 'U';
  
  // PID-11: Address
  const street = getComponent(pid, 11, 0);
  const city = getComponent(pid, 11, 2);
  const state = getComponent(pid, 11, 3);
  const zip = getComponent(pid, 11, 4);
  
  // PID-13: Phone
  const phone = getComponent(pid, 13, 0);
  
  // PID-18 ou PID-19: CPF (varia por implementação brasileira)
  const cpf = getFieldValue(pid, 18) || getFieldValue(pid, 19);
  
  return {
    id: patientId,
    name: fullName || 'Paciente Desconhecido',
    birthDate,
    gender: sex || undefined,
    cpf: cpf || undefined,
    phone: phone || undefined,
    address: street || undefined,
    city: city || undefined,
    state: state || undefined,
    zipCode: zip || undefined,
  };
}

function parseOrderSegments(orc?: HL7Segment, obr?: HL7Segment): HL7Order | undefined {
  if (!orc && !obr) return undefined;
  
  const tests: HL7Test[] = [];
  
  if (obr) {
    // OBR-4: Universal Service ID
    const testCode = getComponent(obr, 4, 0);
    const testName = getComponent(obr, 4, 1);
    const codingSystem = getComponent(obr, 4, 2);
    
    if (testCode || testName) {
      tests.push({ code: testCode, name: testName || testCode, codingSystem });
    }
  }
  
  // ORC-2: Placer Order Number
  const placerOrderNumber = orc ? getFieldValue(orc, 2) : (obr ? getFieldValue(obr, 2) : '');
  
  // ORC-3: Filler Order Number
  const fillerOrderNumber = orc ? getFieldValue(orc, 3) : (obr ? getFieldValue(obr, 3) : '');
  
  // ORC-5 ou OBR-25: Order Status
  const status = (orc ? getFieldValue(orc, 5) : (obr ? getFieldValue(obr, 25) : 'CM')) as HL7Order['status'];
  
  // ORC-7 ou OBR-6: Priority
  const priority = (orc ? getComponent(orc, 7, 5) : 'R') as HL7Order['priority'];
  
  // ORC-9 ou OBR-7: Order DateTime
  const orderDateTime = orc ? getFieldValue(orc, 9) : (obr ? getFieldValue(obr, 7) : '');
  
  return {
    id: fillerOrderNumber || placerOrderNumber || crypto.randomUUID(),
    placerOrderNumber,
    fillerOrderNumber,
    orderDateTime: formatHL7DateTime(orderDateTime),
    status: status || 'CM',
    priority: priority || 'R',
    tests,
  };
}

function parseResultSegment(obx: HL7Segment, orderId?: string): HL7Result {
  // OBX-1: Set ID
  const setId = getFieldValue(obx, 1);
  
  // OBX-2: Value Type (NM=Numeric, ST=String, TX=Text, CE=Coded Entry, etc.)
  const valueType = getFieldValue(obx, 2);
  
  // OBX-3: Observation Identifier
  const testCode = getComponent(obx, 3, 0);
  const testName = getComponent(obx, 3, 1);
  
  // OBX-5: Observation Value
  const value = getFieldValue(obx, 5);
  
  // OBX-6: Units
  const unit = getComponent(obx, 6, 0);
  
  // OBX-7: Reference Range
  const referenceRange = getFieldValue(obx, 7);
  
  // OBX-8: Abnormal Flags
  const abnormalFlag = getFieldValue(obx, 8) as HL7Result['abnormalFlag'];
  
  // OBX-11: Observation Result Status
  const status = (getFieldValue(obx, 11) || 'F') as HL7Result['status'];
  
  // OBX-14: Date/Time of Observation
  const observationDateTime = getFieldValue(obx, 14);
  
  // OBX-15: Producer's ID (Lab)
  const performingLab = getFieldValue(obx, 15);
  
  // NTE segments following OBX contain comments (simplified - would need context)
  const comments: string[] = [];
  
  return {
    orderId: orderId || '',
    observationId: `${orderId}-${setId}`,
    testCode,
    testName: testName || testCode,
    value,
    unit: unit || undefined,
    referenceRange: referenceRange || undefined,
    abnormalFlag: abnormalFlag || undefined,
    status,
    observationDateTime: formatHL7DateTime(observationDateTime),
    performingLab: performingLab || undefined,
    comments,
  };
}

// ─── Formatadores de Data ─────────────────────────────────────────────────────

function formatHL7Date(hl7Date: string): string {
  if (!hl7Date || hl7Date.length < 8) return '';
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function formatHL7DateTime(hl7DateTime: string): string {
  if (!hl7DateTime) return new Date().toISOString();
  if (hl7DateTime.length < 8) return new Date().toISOString();
  
  const year = hl7DateTime.substring(0, 4);
  const month = hl7DateTime.substring(4, 6);
  const day = hl7DateTime.substring(6, 8);
  const hour = hl7DateTime.substring(8, 10) || '00';
  const minute = hl7DateTime.substring(10, 12) || '00';
  const second = hl7DateTime.substring(12, 14) || '00';
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

// ─── Gerador de ACK ───────────────────────────────────────────────────────────

export interface ACKOptions {
  originalMessage: HL7Message;
  ackCode: 'AA' | 'AE' | 'AR'; // Accept, Error, Reject
  errorMessage?: string;
  sendingApplication?: string;
  sendingFacility?: string;
}

export function generateACK(options: ACKOptions): string {
  const { originalMessage, ackCode, errorMessage, sendingApplication, sendingFacility } = options;
  const now = new Date();
  const timestamp = formatDateToHL7(now);
  const messageControlId = crypto.randomUUID().substring(0, 20);
  
  const lines: string[] = [];
  
  // MSH Segment
  lines.push([
    'MSH',
    '^~\\&',
    sendingApplication || 'CLINICNEST',
    sendingFacility || '',
    originalMessage.sendingApplication || '',
    originalMessage.sendingFacility || '',
    timestamp,
    '',
    'ACK',
    messageControlId,
    'P',
    originalMessage.version || '2.5',
  ].join('|'));
  
  // MSA Segment (Message Acknowledgment)
  lines.push([
    'MSA',
    ackCode,
    originalMessage.messageControlId,
    errorMessage || '',
  ].join('|'));
  
  // ERR Segment (if error)
  if (ackCode !== 'AA' && errorMessage) {
    lines.push([
      'ERR',
      '',
      '',
      '',
      'E',
      '',
      '',
      errorMessage,
    ].join('|'));
  }
  
  return lines.join('\r');
}

function formatDateToHL7(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// ─── Gerador de Pedido de Exame (ORM^O01) ─────────────────────────────────────

export interface LabOrderRequest {
  patient: {
    id: string;
    name: string;
    birthDate?: string;
    gender?: 'M' | 'F';
    cpf?: string;
  };
  order: {
    id: string;
    priority?: 'S' | 'A' | 'R';
    tests: Array<{ code: string; name: string }>;
  };
  provider: {
    id?: string;
    name: string;
    crm?: string;
  };
  clinic: {
    name: string;
    cnes?: string;
  };
}

export function generateLabOrder(request: LabOrderRequest): string {
  const now = new Date();
  const timestamp = formatDateToHL7(now);
  const messageControlId = crypto.randomUUID().substring(0, 20);
  
  const lines: string[] = [];
  
  // MSH Segment
  lines.push([
    'MSH',
    '^~\\&',
    'CLINICNEST',
    request.clinic.cnes || request.clinic.name,
    'LAB',
    '',
    timestamp,
    '',
    'ORM^O01',
    messageControlId,
    'P',
    '2.5',
  ].join('|'));
  
  // PID Segment
  const nameParts = request.patient.name.split(' ');
  const familyName = nameParts.length > 1 ? nameParts.slice(-1).join(' ') : request.patient.name;
  const givenName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const birthDateHL7 = request.patient.birthDate?.replace(/-/g, '') || '';
  
  lines.push([
    'PID',
    '1',
    '',
    request.patient.id,
    '',
    `${familyName}^${givenName}`,
    '',
    birthDateHL7,
    request.patient.gender || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    request.patient.cpf || '',
  ].join('|'));
  
  // PV1 Segment (Patient Visit)
  lines.push([
    'PV1',
    '1',
    'O', // Outpatient
    '',
    '',
    '',
    '',
    `${request.provider.id || ''}^${request.provider.name}^^^^^${request.provider.crm || ''}`,
  ].join('|'));
  
  // ORC Segment (Common Order)
  lines.push([
    'ORC',
    'NW', // New Order
    request.order.id,
    '',
    '',
    '',
    '',
    `^^^${timestamp}^^${request.order.priority || 'R'}`,
    '',
    timestamp,
    '',
    `${request.provider.id || ''}^${request.provider.name}`,
    '',
    '',
    '',
    '',
    request.clinic.name,
  ].join('|'));
  
  // OBR Segments (one per test)
  request.order.tests.forEach((test, index) => {
    lines.push([
      'OBR',
      String(index + 1),
      request.order.id,
      '',
      `${test.code}^${test.name}`,
      request.order.priority || 'R',
      timestamp,
    ].join('|'));
  });
  
  return lines.join('\r');
}

// ─── Validador de Mensagem HL7 ────────────────────────────────────────────────

export interface HL7ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateHL7Message(raw: string): HL7ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!raw || !raw.trim()) {
    errors.push('Mensagem vazia');
    return { valid: false, errors, warnings };
  }
  
  const lines = raw.trim().split(/\r?\n|\r/);
  
  // Check MSH segment
  if (!lines[0]?.startsWith('MSH')) {
    errors.push('Mensagem deve começar com segmento MSH');
    return { valid: false, errors, warnings };
  }
  
  // Validate MSH structure
  const mshFields = lines[0].split('|');
  if (mshFields.length < 12) {
    errors.push('Segmento MSH incompleto (mínimo 12 campos)');
  }
  
  // Check message type
  const messageType = mshFields[8];
  if (!messageType) {
    errors.push('Tipo de mensagem (MSH-9) não especificado');
  }
  
  // Check version
  const version = mshFields[11];
  if (!version) {
    warnings.push('Versão HL7 (MSH-12) não especificada');
  } else if (!['2.3', '2.3.1', '2.4', '2.5', '2.5.1'].includes(version)) {
    warnings.push(`Versão HL7 ${version} pode não ser totalmente suportada`);
  }
  
  // Check for required segments based on message type
  const segmentNames = lines.map(l => l.substring(0, 3));
  
  if (messageType?.startsWith('ORU')) {
    if (!segmentNames.includes('PID')) {
      errors.push('Mensagem ORU requer segmento PID (paciente)');
    }
    if (!segmentNames.includes('OBX')) {
      errors.push('Mensagem ORU requer pelo menos um segmento OBX (resultado)');
    }
  }
  
  if (messageType?.startsWith('ORM')) {
    if (!segmentNames.includes('PID')) {
      errors.push('Mensagem ORM requer segmento PID (paciente)');
    }
    if (!segmentNames.includes('ORC') && !segmentNames.includes('OBR')) {
      errors.push('Mensagem ORM requer segmento ORC ou OBR (pedido)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Parser de Mensagens ADT (Admissão/Alta/Transferência) ────────────────────

export const ADT_EVENT_TYPES = {
  A01: 'Admissão',
  A02: 'Transferência',
  A03: 'Alta',
  A04: 'Registro de Paciente',
  A08: 'Atualização de Informações',
  A11: 'Cancelamento de Admissão',
  A12: 'Cancelamento de Transferência',
  A13: 'Cancelamento de Alta',
  A28: 'Adicionar Pessoa',
  A31: 'Atualizar Pessoa',
  A40: 'Merge de Pacientes',
} as const;

export interface HL7ADTEvent {
  eventType: keyof typeof ADT_EVENT_TYPES;
  eventDescription: string;
  eventDateTime: string;
  patient: HL7Patient;
  visit?: HL7Visit;
  location?: HL7Location;
  attendingDoctor?: HL7Provider;
  admitSource?: string;
  dischargeDisposition?: string;
  message: HL7Message;
  errors: string[];
}

export interface HL7Visit {
  visitNumber: string;
  patientClass: 'I' | 'O' | 'E' | 'P' | 'R' | 'B' | 'C' | 'N' | 'U'; // Inpatient, Outpatient, Emergency, Preadmit, Recurring, Obstetrics, Commercial, Not Applicable, Unknown
  admitDateTime?: string;
  dischargeDateTime?: string;
  visitIndicator?: string;
}

export interface HL7Location {
  pointOfCare?: string;
  room?: string;
  bed?: string;
  facility?: string;
  building?: string;
  floor?: string;
}

export interface HL7Provider {
  id?: string;
  name: string;
  specialty?: string;
  council?: string;
  councilNumber?: string;
}

export function parseADTMessage(raw: string): HL7ADTEvent {
  const errors: string[] = [];
  let message: HL7Message;
  
  try {
    message = parseHL7Message(raw);
  } catch (e) {
    return {
      eventType: 'A01',
      eventDescription: 'Erro',
      eventDateTime: new Date().toISOString(),
      patient: { id: '', name: '' },
      message: { raw, segments: [], messageType: '', messageControlId: '', version: '', dateTime: '' },
      errors: [`Erro ao parsear mensagem: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  
  // Extract event type from message type (e.g., ADT^A01 -> A01)
  const messageTypeParts = message.messageType.split('^');
  const eventCode = messageTypeParts[1] as keyof typeof ADT_EVENT_TYPES || 'A01';
  
  // Parse Patient (PID segment)
  const pid = message.segments.find(s => s.name === 'PID');
  const patient = parsePatientSegment(pid);
  
  if (!patient.id && !patient.name) {
    errors.push('Segmento PID não encontrado ou inválido');
  }
  
  // Parse Visit (PV1 segment)
  const pv1 = message.segments.find(s => s.name === 'PV1');
  const visit = parseVisitSegment(pv1);
  
  // Parse Location from PV1
  const location = parseLocationFromPV1(pv1);
  
  // Parse Attending Doctor from PV1
  const attendingDoctor = parseAttendingDoctor(pv1);
  
  // Parse EVN segment for event details
  const evn = message.segments.find(s => s.name === 'EVN');
  const eventDateTime = evn ? formatHL7DateTime(getFieldValue(evn, 2) || getFieldValue(evn, 6)) : message.dateTime;
  
  // Get admit source and discharge disposition
  const admitSource = pv1 ? getFieldValue(pv1, 14) : undefined;
  const dischargeDisposition = pv1 ? getFieldValue(pv1, 36) : undefined;
  
  return {
    eventType: eventCode,
    eventDescription: ADT_EVENT_TYPES[eventCode] || 'Evento Desconhecido',
    eventDateTime: formatHL7DateTime(eventDateTime),
    patient,
    visit,
    location,
    attendingDoctor,
    admitSource,
    dischargeDisposition,
    message,
    errors,
  };
}

function parseVisitSegment(pv1?: HL7Segment): HL7Visit | undefined {
  if (!pv1) return undefined;
  
  const patientClass = getFieldValue(pv1, 2) as HL7Visit['patientClass'] || 'U';
  const visitNumber = getComponent(pv1, 19, 0);
  const admitDateTime = getFieldValue(pv1, 44);
  const dischargeDateTime = getFieldValue(pv1, 45);
  
  return {
    visitNumber,
    patientClass,
    admitDateTime: admitDateTime ? formatHL7DateTime(admitDateTime) : undefined,
    dischargeDateTime: dischargeDateTime ? formatHL7DateTime(dischargeDateTime) : undefined,
  };
}

function parseLocationFromPV1(pv1?: HL7Segment): HL7Location | undefined {
  if (!pv1) return undefined;
  
  // PV1-3: Assigned Patient Location
  const locationField = pv1.fields[3];
  if (!locationField) return undefined;
  
  const components = locationField.components;
  
  return {
    pointOfCare: components[0] || undefined,
    room: components[1] || undefined,
    bed: components[2] || undefined,
    facility: components[3] || undefined,
    building: components[6] || undefined,
    floor: components[7] || undefined,
  };
}

function parseAttendingDoctor(pv1?: HL7Segment): HL7Provider | undefined {
  if (!pv1) return undefined;
  
  // PV1-7: Attending Doctor
  const doctorField = pv1.fields[7];
  if (!doctorField || !doctorField.value) return undefined;
  
  const components = doctorField.components;
  const familyName = components[1] || '';
  const givenName = components[2] || '';
  
  return {
    id: components[0] || undefined,
    name: [givenName, familyName].filter(Boolean).join(' ') || 'Médico Desconhecido',
    specialty: components[9] || undefined,
    council: components[8] || undefined,
    councilNumber: components[0] || undefined,
  };
}

// ─── Gerador de Mensagens ADT ─────────────────────────────────────────────────

export interface ADTMessageRequest {
  eventType: keyof typeof ADT_EVENT_TYPES;
  patient: {
    id: string;
    name: string;
    birthDate?: string;
    gender?: 'M' | 'F';
    cpf?: string;
  };
  visit?: {
    visitNumber?: string;
    patientClass?: 'I' | 'O' | 'E';
    admitDateTime?: string;
    dischargeDateTime?: string;
  };
  location?: {
    pointOfCare?: string;
    room?: string;
    bed?: string;
  };
  provider?: {
    id?: string;
    name: string;
    crm?: string;
  };
  clinic: {
    name: string;
    cnes?: string;
  };
}

export function generateADTMessage(request: ADTMessageRequest): string {
  const now = new Date();
  const timestamp = formatDateToHL7(now);
  const messageControlId = crypto.randomUUID().substring(0, 20);
  
  const lines: string[] = [];
  
  // MSH Segment
  lines.push([
    'MSH',
    '^~\\&',
    'CLINICNEST',
    request.clinic.cnes || request.clinic.name,
    'HOSPITAL',
    '',
    timestamp,
    '',
    `ADT^${request.eventType}`,
    messageControlId,
    'P',
    '2.5',
  ].join('|'));
  
  // EVN Segment (Event Type)
  lines.push([
    'EVN',
    request.eventType,
    timestamp,
    '',
    '',
    timestamp,
  ].join('|'));
  
  // PID Segment
  const nameParts = request.patient.name.split(' ');
  const familyName = nameParts.length > 1 ? nameParts.slice(-1).join(' ') : request.patient.name;
  const givenName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const birthDateHL7 = request.patient.birthDate?.replace(/-/g, '') || '';
  
  lines.push([
    'PID',
    '1',
    '',
    request.patient.id,
    '',
    `${familyName}^${givenName}`,
    '',
    birthDateHL7,
    request.patient.gender || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    request.patient.cpf || '',
  ].join('|'));
  
  // PV1 Segment (Patient Visit)
  const locationStr = request.location 
    ? `${request.location.pointOfCare || ''}^${request.location.room || ''}^${request.location.bed || ''}`
    : '';
  const providerStr = request.provider
    ? `${request.provider.id || ''}^${request.provider.name}^^^^^${request.provider.crm || ''}`
    : '';
  const admitDT = request.visit?.admitDateTime?.replace(/[-:T]/g, '').substring(0, 14) || timestamp;
  const dischargeDT = request.visit?.dischargeDateTime?.replace(/[-:T]/g, '').substring(0, 14) || '';
  
  lines.push([
    'PV1',
    '1',
    request.visit?.patientClass || 'O',
    locationStr,
    '',
    '',
    '',
    providerStr,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    request.visit?.visitNumber || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    admitDT,
    dischargeDT,
  ].join('|'));
  
  return lines.join('\r');
}

// ─── Mapeamento para FHIR ─────────────────────────────────────────────────────

export function mapHL7ResultToFHIR(result: HL7ParsedLabResult): object {
  const bundle: object = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [] as object[],
  };
  
  // Patient resource
  if (result.patient.id || result.patient.name) {
    const patientResource = {
      resourceType: 'Patient',
      id: result.patient.id || crypto.randomUUID(),
      name: [{ text: result.patient.name }],
      birthDate: result.patient.birthDate,
      gender: result.patient.gender === 'M' ? 'male' : result.patient.gender === 'F' ? 'female' : 'unknown',
      identifier: result.patient.cpf ? [{ system: 'http://rnds-fhir.saude.gov.br/NamingSystem/cpf', value: result.patient.cpf }] : undefined,
    };
    (bundle as any).entry.push({ resource: patientResource });
  }
  
  // DiagnosticReport resource
  if (result.order) {
    const diagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: result.order.id,
      status: result.order.status === 'CM' ? 'final' : 'preliminary',
      code: {
        coding: result.order.tests.map(t => ({
          code: t.code,
          display: t.name,
          system: t.codingSystem,
        })),
      },
      subject: { reference: `Patient/${result.patient.id}` },
      effectiveDateTime: result.order.orderDateTime,
      result: result.results.map(r => ({ reference: `Observation/${r.observationId}` })),
    };
    (bundle as any).entry.push({ resource: diagnosticReport });
  }
  
  // Observation resources
  for (const obs of result.results) {
    const observation = {
      resourceType: 'Observation',
      id: obs.observationId,
      status: obs.status === 'F' ? 'final' : obs.status === 'P' ? 'preliminary' : 'corrected',
      code: {
        coding: [{ code: obs.testCode, display: obs.testName }],
        text: obs.testName,
      },
      subject: { reference: `Patient/${result.patient.id}` },
      effectiveDateTime: obs.observationDateTime,
      valueQuantity: obs.unit ? { value: parseFloat(obs.value) || undefined, unit: obs.unit } : undefined,
      valueString: !obs.unit ? obs.value : undefined,
      referenceRange: obs.referenceRange ? [{ text: obs.referenceRange }] : undefined,
      interpretation: obs.abnormalFlag ? [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: obs.abnormalFlag,
        }],
      }] : undefined,
    };
    (bundle as any).entry.push({ resource: observation });
  }
  
  return bundle;
}
