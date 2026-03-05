/**
 * Sistema de Planos e Monetização — Fase 27
 * 
 * Define a estrutura de planos, limites e funcionalidades disponíveis
 * para cada tier de assinatura do ClinicNest.
 */

export type SubscriptionTier = 'starter' | 'solo' | 'clinica' | 'premium';
export type SubscriptionInterval = 'monthly' | 'annual';

export type FeatureKey =
  // Recepção
  | 'agenda'
  | 'waitlist'
  | 'returnReminders'
  | 'availability'
  | 'callPanel'
  // Clínico
  | 'patients'
  | 'triage'
  | 'medicalRecords'
  | 'soapEvolutions'
  | 'nursingEvolutions'
  | 'teleconsulta'
  | 'internalChat'
  // Documentos
  | 'prescriptions'
  | 'certificates'
  | 'reports'
  | 'referrals'
  | 'contracts'
  // Odontologia
  | 'odontogram'
  | 'periogram'
  | 'treatmentPlans'
  | 'dentalImages'
  // Financeiro
  | 'basicFinancial'
  | 'advancedFinancial'
  | 'tissGuides'
  | 'tissBilling'
  | 'glossManagement'
  | 'insurancePlans'
  | 'basicReports'
  | 'advancedReports'
  | 'customReports'
  // Estoque
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  // Marketing
  | 'onlineBooking'
  | 'campaigns'
  | 'automations'
  // Administração
  | 'team'
  | 'basicRbac'
  | 'advancedRbac'
  | 'multiUnit'
  | 'rooms'
  | 'procedures'
  | 'specialties'
  | 'recordTemplates'
  | 'integrations'
  | 'apiAccess'
  | 'compliance'
  | 'sngpc'
  | 'audit'
  | 'dataRetention'
  | 'onaDashboard'
  // Financeiro Profissional
  | 'commissions'
  // Inteligência Artificial
  | 'aiTriage'
  | 'aiCidSuggest'
  | 'aiSummary'
  | 'aiTranscribe'
  | 'aiSentiment'
  | 'aiAgentChat'
  | 'aiPatientChat';

export type LimitKey =
  | 'professionals'
  | 'patients'
  | 'appointmentsPerMonth'
  | 'teleconsultasPerMonth'
  | 'smsPerMonth'
  | 'storageGb'
  | 'historyMonths'
  | 'automations'
  | 'webhooks'
  | 'units'
  | 'customReports'
  | 'aiRequestsPerDay'
  | 'aiTranscribeMinutesPerMonth';

export interface PlanLimits {
  professionals: number;
  patients: number;
  appointmentsPerMonth: number;
  teleconsultasPerMonth: number;
  smsPerMonth: number;
  storageGb: number;
  historyMonths: number;
  automations: number;
  webhooks: number;
  units: number;
  customReports: number;
  aiRequestsPerDay: number;
  aiTranscribeMinutesPerMonth: number;
}

export interface PlanFeatures {
  [key: string]: boolean;
}

export interface PlanConfig {
  name: string;
  tagline: string;
  target: string;
  price: {
    monthly: number;
    annual: number;
  };
  limits: PlanLimits;
  features: Record<FeatureKey, boolean>;
}

export const UNLIMITED = -1;

export const PLAN_CONFIG: Record<SubscriptionTier, PlanConfig> = {
  starter: {
    name: 'Starter',
    tagline: 'Para começar',
    target: 'Profissional iniciante, consultório simples',
    price: {
      monthly: 89.90,
      annual: 809.00,
    },
    limits: {
      professionals: 1,
      patients: 100,
      appointmentsPerMonth: 200,
      teleconsultasPerMonth: 5,
      smsPerMonth: 50,
      storageGb: 1,
      historyMonths: 6,
      automations: 0,
      webhooks: 0,
      units: 1,
      customReports: 0,
      aiRequestsPerDay: 10,
      aiTranscribeMinutesPerMonth: 0,
    },
    features: {
      // Recepção
      agenda: true,
      waitlist: false,
      returnReminders: false,
      availability: true,
      callPanel: false,
      // Clínico
      patients: true,
      triage: false,
      medicalRecords: true,
      soapEvolutions: false,
      nursingEvolutions: false,
      teleconsulta: true,
      internalChat: false,
      // Documentos
      prescriptions: true,
      certificates: true,
      reports: false,
      referrals: false,
      contracts: false,
      // Odontologia
      odontogram: false,
      periogram: false,
      treatmentPlans: false,
      dentalImages: false,
      // Financeiro
      basicFinancial: true,
      advancedFinancial: false,
      tissGuides: false,
      tissBilling: false,
      glossManagement: false,
      insurancePlans: false,
      basicReports: true,
      advancedReports: false,
      customReports: false,
      // Estoque
      inventory: true,
      purchases: false,
      suppliers: false,
      // Marketing
      onlineBooking: true,
      campaigns: false,
      automations: false,
      // Administração
      team: false,
      basicRbac: false,
      advancedRbac: false,
      multiUnit: false,
      rooms: false,
      procedures: true,
      specialties: false,
      recordTemplates: false,
      integrations: false,
      apiAccess: false,
      compliance: false,
      sngpc: false,
      audit: false,
      dataRetention: false,
      onaDashboard: false,
      // Financeiro Profissional
      commissions: false,
      // Inteligência Artificial
      aiTriage: true,
      aiCidSuggest: true,
      aiSummary: false,
      aiTranscribe: false,
      aiSentiment: false,
      aiAgentChat: true,
      aiPatientChat: true,
    },
  },

  solo: {
    name: 'Solo',
    tagline: 'Para profissionais autônomos',
    target: 'Médico, psicólogo, fisioterapeuta individual',
    price: {
      monthly: 159.90,
      annual: 1439.10,
    },
    limits: {
      professionals: 2,
      patients: 500,
      appointmentsPerMonth: 500,
      teleconsultasPerMonth: 10,
      smsPerMonth: 200,
      storageGb: 5,
      historyMonths: 12,
      automations: 3,
      webhooks: 0,
      units: 1,
      customReports: 0,
      aiRequestsPerDay: 25,
      aiTranscribeMinutesPerMonth: 0,
    },
    features: {
      // Recepção
      agenda: true,
      waitlist: true,
      returnReminders: true,
      availability: true,
      callPanel: false,
      // Clínico
      patients: true,
      triage: false,
      medicalRecords: true,
      soapEvolutions: true,
      nursingEvolutions: false,
      teleconsulta: true,
      internalChat: true,
      // Documentos
      prescriptions: true,
      certificates: true,
      reports: true,
      referrals: true,
      contracts: true,
      // Odontologia
      odontogram: false,
      periogram: false,
      treatmentPlans: false,
      dentalImages: false,
      // Financeiro
      basicFinancial: true,
      advancedFinancial: false,
      tissGuides: false,
      tissBilling: false,
      glossManagement: false,
      insurancePlans: false,
      basicReports: true,
      advancedReports: false,
      customReports: false,
      // Estoque
      inventory: true,
      purchases: true,
      suppliers: true,
      // Marketing
      onlineBooking: true,
      campaigns: true,
      automations: true,
      // Administração
      team: true,
      basicRbac: true,
      advancedRbac: false,
      multiUnit: false,
      rooms: false,
      procedures: true,
      specialties: true,
      recordTemplates: true,
      integrations: true,
      apiAccess: false,
      compliance: false,
      sngpc: false,
      audit: false,
      dataRetention: false,
      onaDashboard: false,
      // Financeiro Profissional
      commissions: false,
      // Inteligência Artificial
      aiTriage: true,
      aiCidSuggest: true,
      aiSummary: true,
      aiTranscribe: false,
      aiSentiment: true,
      aiAgentChat: true,
      aiPatientChat: true,
    },
  },

  clinica: {
    name: 'Clínica',
    tagline: 'Para clínicas em crescimento',
    target: 'Clínicas com equipe e múltiplos profissionais',
    price: {
      monthly: 289.90,
      annual: 2609.10,
    },
    limits: {
      professionals: 6,
      patients: 3000,
      appointmentsPerMonth: UNLIMITED,
      teleconsultasPerMonth: 30,
      smsPerMonth: 500,
      storageGb: 20,
      historyMonths: UNLIMITED,
      automations: 10,
      webhooks: 5,
      units: 1,
      customReports: 5,
      aiRequestsPerDay: 60,
      aiTranscribeMinutesPerMonth: 60,
    },
    features: {
      // Recepção
      agenda: true,
      waitlist: true,
      returnReminders: true,
      availability: true,
      callPanel: true,
      // Clínico
      patients: true,
      triage: true,
      medicalRecords: true,
      soapEvolutions: true,
      nursingEvolutions: true,
      teleconsulta: true,
      internalChat: true,
      // Documentos
      prescriptions: true,
      certificates: true,
      reports: true,
      referrals: true,
      contracts: true,
      // Odontologia
      odontogram: true,
      periogram: true,
      treatmentPlans: true,
      dentalImages: true,
      // Financeiro
      basicFinancial: true,
      advancedFinancial: true,
      tissGuides: true,
      tissBilling: true,
      glossManagement: false,
      insurancePlans: true,
      basicReports: true,
      advancedReports: true,
      customReports: true,
      // Estoque
      inventory: true,
      purchases: true,
      suppliers: true,
      // Marketing
      onlineBooking: true,
      campaigns: true,
      automations: true,
      // Administração
      team: true,
      basicRbac: true,
      advancedRbac: true,
      multiUnit: false,
      rooms: true,
      procedures: true,
      specialties: true,
      recordTemplates: true,
      integrations: true,
      apiAccess: false,
      compliance: true,
      sngpc: true,
      audit: true,
      dataRetention: true,
      onaDashboard: false,
      // Financeiro Profissional
      commissions: true,
      // Inteligência Artificial
      aiTriage: true,
      aiCidSuggest: true,
      aiSummary: true,
      aiTranscribe: true,
      aiSentiment: true,
      aiAgentChat: true,
      aiPatientChat: true,
    },
  },

  premium: {
    name: 'Premium',
    tagline: 'Para policlínicas e centros médicos',
    target: 'Múltiplas especialidades, alta demanda',
    price: {
      monthly: 399.90,
      annual: 3599.00,
    },
    limits: {
      professionals: UNLIMITED,
      patients: UNLIMITED,
      appointmentsPerMonth: UNLIMITED,
      teleconsultasPerMonth: UNLIMITED,
      smsPerMonth: UNLIMITED,
      storageGb: UNLIMITED,
      historyMonths: UNLIMITED,
      automations: UNLIMITED,
      webhooks: UNLIMITED,
      units: UNLIMITED,
      customReports: UNLIMITED,
      aiRequestsPerDay: UNLIMITED,
      aiTranscribeMinutesPerMonth: UNLIMITED,
    },
    features: {
      // Recepção
      agenda: true,
      waitlist: true,
      returnReminders: true,
      availability: true,
      callPanel: true,
      // Clínico
      patients: true,
      triage: true,
      medicalRecords: true,
      soapEvolutions: true,
      nursingEvolutions: true,
      teleconsulta: true,
      internalChat: true,
      // Documentos
      prescriptions: true,
      certificates: true,
      reports: true,
      referrals: true,
      contracts: true,
      // Odontologia
      odontogram: true,
      periogram: true,
      treatmentPlans: true,
      dentalImages: true,
      // Financeiro
      basicFinancial: true,
      advancedFinancial: true,
      tissGuides: true,
      tissBilling: true,
      glossManagement: true,
      insurancePlans: true,
      basicReports: true,
      advancedReports: true,
      customReports: true,
      // Estoque
      inventory: true,
      purchases: true,
      suppliers: true,
      // Marketing
      onlineBooking: true,
      campaigns: true,
      automations: true,
      // Administração
      team: true,
      basicRbac: true,
      advancedRbac: true,
      multiUnit: true,
      rooms: true,
      procedures: true,
      specialties: true,
      recordTemplates: true,
      integrations: true,
      apiAccess: true,
      compliance: true,
      sngpc: true,
      audit: true,
      dataRetention: true,
      onaDashboard: true,
      // Financeiro Profissional
      commissions: true,
      // Inteligência Artificial
      aiTriage: true,
      aiCidSuggest: true,
      aiSummary: true,
      aiTranscribe: true,
      aiSentiment: true,
      aiAgentChat: true,
      aiPatientChat: true,
    },
  },
};

export const TIER_ORDER: SubscriptionTier[] = ['starter', 'solo', 'clinica', 'premium'];

export function getTierIndex(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isHigherTier(tier1: SubscriptionTier, tier2: SubscriptionTier): boolean {
  return getTierIndex(tier1) > getTierIndex(tier2);
}

export function getMinimumTierForFeature(feature: FeatureKey): SubscriptionTier | null {
  for (const tier of TIER_ORDER) {
    if (PLAN_CONFIG[tier].features[feature]) {
      return tier;
    }
  }
  return null;
}

export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const currentIndex = getTierIndex(currentTier);
  if (currentIndex < TIER_ORDER.length - 1) {
    return TIER_ORDER[currentIndex + 1];
  }
  return null;
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  // Recepção
  agenda: 'Agenda',
  waitlist: 'Lista de Espera',
  returnReminders: 'Lembretes de Retorno',
  availability: 'Disponibilidade',
  callPanel: 'Painel de Chamada',
  // Clínico
  patients: 'Pacientes',
  triage: 'Triagem',
  medicalRecords: 'Prontuários',
  soapEvolutions: 'Evoluções SOAP',
  nursingEvolutions: 'Evolução de Enfermagem',
  teleconsulta: 'Teleconsulta',
  internalChat: 'Chat Interno',
  // Documentos
  prescriptions: 'Receituários',
  certificates: 'Atestados',
  reports: 'Laudos',
  referrals: 'Encaminhamentos',
  contracts: 'Contratos e Termos',
  // Odontologia
  odontogram: 'Odontograma',
  periogram: 'Periograma',
  treatmentPlans: 'Planos de Tratamento',
  dentalImages: 'Imagens Odontológicas',
  // Financeiro
  basicFinancial: 'Financeiro Básico',
  advancedFinancial: 'Financeiro Avançado',
  tissGuides: 'Guias TISS',
  tissBilling: 'Faturamento TISS',
  glossManagement: 'Gestão de Glosas',
  insurancePlans: 'Convênios',
  basicReports: 'Relatórios Básicos',
  advancedReports: 'Relatórios Avançados',
  customReports: 'Relatórios Customizáveis',
  // Estoque
  inventory: 'Estoque',
  purchases: 'Compras',
  suppliers: 'Fornecedores',
  // Marketing
  onlineBooking: 'Agendamento Online',
  campaigns: 'Campanhas',
  automations: 'Automações',
  // Administração
  team: 'Equipe',
  basicRbac: 'Permissões Básicas',
  advancedRbac: 'Permissões Avançadas',
  multiUnit: 'Multi-unidade',
  rooms: 'Gestão de Salas',
  procedures: 'Procedimentos',
  specialties: 'Especialidades',
  recordTemplates: 'Modelos de Prontuário',
  integrations: 'Integrações',
  apiAccess: 'API Pública',
  compliance: 'Compliance e LGPD',
  sngpc: 'SNGPC/ANVISA',
  audit: 'Auditoria',
  dataRetention: 'Retenção de Dados',
  onaDashboard: 'Dashboard ONA',
  // Financeiro Profissional
  commissions: 'Comissões',
  // Inteligência Artificial
  aiTriage: 'Triagem IA',
  aiCidSuggest: 'Sugestão CID por IA',
  aiSummary: 'Resumo Clínico IA',
  aiTranscribe: 'Transcrição de Consultas',
  aiSentiment: 'Análise de Sentimento',
  aiAgentChat: 'Assistente IA',
  aiPatientChat: 'Chat IA do Paciente',
};

export const LIMIT_LABELS: Record<LimitKey, string> = {
  professionals: 'Profissionais',
  patients: 'Pacientes',
  appointmentsPerMonth: 'Agendamentos/mês',
  teleconsultasPerMonth: 'Teleconsultas/mês',
  smsPerMonth: 'SMS/mês',
  storageGb: 'Armazenamento (GB)',
  historyMonths: 'Histórico (meses)',
  automations: 'Automações',
  webhooks: 'Webhooks',
  units: 'Unidades',
  customReports: 'Relatórios customizados',
  aiRequestsPerDay: 'Requisições IA/dia',
  aiTranscribeMinutesPerMonth: 'Minutos transcrição/mês',
};

export function formatLimit(value: number, key?: LimitKey): string {
  if (value === UNLIMITED) {
    return 'Ilimitado';
  }
  if (key === 'storageGb') {
    return `${value} GB`;
  }
  if (key === 'historyMonths') {
    return value === 1 ? '1 mês' : `${value} meses`;
  }
  if (key === 'aiTranscribeMinutesPerMonth') {
    return `${value} min`;
  }
  if (key === 'aiRequestsPerDay') {
    return `${value}/dia`;
  }
  return value.toLocaleString('pt-BR');
}
