/**
 * Presets de módulos por tipo de clínica.
 *
 * Quando o admin escolhe o tipo de clínica, o sistema sugere quais módulos
 * devem ficar ativados. O admin pode personalizar depois no Painel de Módulos.
 */

import type { FeatureKey } from './subscription-plans';

// ─── Tipos de Clínica ───────────────────────────────────────────────

export const CLINIC_TYPES = [
  { value: 'clinica_geral',   label: 'Clínica Médica Geral' },
  { value: 'odontologica',    label: 'Clínica Odontológica' },
  { value: 'estetica',        label: 'Clínica de Estética' },
  { value: 'fisioterapia',    label: 'Clínica de Fisioterapia' },
  { value: 'psicologia',      label: 'Clínica de Psicologia' },
  { value: 'oftalmologia',    label: 'Clínica de Oftalmologia' },
  { value: 'pediatria',       label: 'Clínica de Pediatria' },
  { value: 'multidisciplinar', label: 'Multidisciplinar' },
] as const;

export type ClinicType = (typeof CLINIC_TYPES)[number]['value'];

// ─── Módulos (agrupam FeatureKeys relacionados) ─────────────────────

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  icon: string;               // nome do ícone Lucide
  features: FeatureKey[];     // FeatureKeys que esse módulo controla
  category: 'recepcao' | 'clinico' | 'documentos' | 'odontologia' | 'financeiro' | 'repasses' | 'suprimentos' | 'marketing' | 'admin' | 'ia';
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // Recepção
  {
    key: 'agenda',
    label: 'Agenda & Recepção',
    description: 'Agendamentos, lista de espera e painel de chamadas',
    icon: 'Calendar',
    features: ['agenda', 'waitlist', 'returnReminders', 'availability', 'callPanel'],
    category: 'recepcao',
  },
  // Clínico
  {
    key: 'prontuarios',
    label: 'Prontuários',
    description: 'Prontuários eletrônicos, evoluções SOAP e triagem',
    icon: 'ClipboardList',
    features: ['patients', 'medicalRecords', 'soapEvolutions', 'nursingEvolutions', 'triage'],
    category: 'clinico',
  },
  {
    key: 'teleconsulta',
    label: 'Teleconsulta',
    description: 'Consultas por vídeo e chat interno da equipe',
    icon: 'Video',
    features: ['teleconsulta', 'internalChat'],
    category: 'clinico',
  },
  // Documentos
  {
    key: 'documentos',
    label: 'Documentos',
    description: 'Receituários, atestados, laudos, encaminhamentos e contratos',
    icon: 'FileText',
    features: ['prescriptions', 'certificates', 'reports', 'referrals', 'contracts'],
    category: 'documentos',
  },
  // Odontologia
  {
    key: 'odontologia',
    label: 'Odontologia',
    description: 'Odontograma, periograma e planos de tratamento',
    icon: 'Smile',
    features: ['odontogram', 'periogram', 'treatmentPlans', 'dentalImages'],
    category: 'odontologia',
  },
  // Financeiro
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Faturamento, contas a pagar/receber e relatórios financeiros',
    icon: 'DollarSign',
    features: ['basicFinancial', 'advancedFinancial', 'basicReports', 'advancedReports', 'customReports'],
    category: 'financeiro',
  },
  {
    key: 'convenios',
    label: 'Convênios & TISS',
    description: 'Gestão de convênios, guias TISS e faturamento',
    icon: 'Building2',
    features: ['insurancePlans', 'tissGuides', 'tissBilling', 'glossManagement'],
    category: 'financeiro',
  },
  // Repasses
  {
    key: 'repasses',
    label: 'Repasses & Comissões',
    description: 'Comissões, salários e regras de repasse',
    icon: 'Wallet',
    features: ['commissions'],
    category: 'repasses',
  },
  // Suprimentos
  {
    key: 'suprimentos',
    label: 'Suprimentos',
    description: 'Insumos médicos, compras e fornecedores',
    icon: 'Package',
    features: ['inventory', 'purchases', 'suppliers'],
    category: 'suprimentos',
  },
  // Marketing
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Campanhas, automações e agendamento online',
    icon: 'Sparkles',
    features: ['onlineBooking', 'campaigns', 'automations'],
    category: 'marketing',
  },
  // Administração
  {
    key: 'admin',
    label: 'Administração',
    description: 'Equipe, salas, especialidades e compliance',
    icon: 'Settings',
    features: ['team', 'basicRbac', 'advancedRbac', 'multiUnit', 'rooms', 'procedures', 'specialties', 'recordTemplates', 'integrations', 'apiAccess', 'compliance', 'sngpc', 'audit', 'dataRetention'],
    category: 'admin',
  },
  // IA
  {
    key: 'ia',
    label: 'Inteligência Artificial',
    description: 'Triagem IA, resumos, transcrição e copiloto clínico',
    icon: 'Bot',
    features: ['aiTriage', 'aiCidSuggest', 'aiSummary', 'aiTranscribe', 'aiSentiment', 'aiAgentChat', 'aiPatientChat', 'aiCopilot', 'aiDrugInteractions', 'aiCancelPrediction', 'aiExplainPatient', 'aiWeeklySummary', 'revenueIntelligence', 'clinicalProtocols', 'benchmarking'],
    category: 'ia',
  },
];

// ─── Presets por tipo de clínica ────────────────────────────────────

/** Chaves de módulo que ficam ativados por padrão para cada tipo de clínica */
export const CLINIC_TYPE_PRESETS: Record<ClinicType, string[]> = {
  clinica_geral: [
    'agenda', 'prontuarios', 'teleconsulta', 'documentos',
    'financeiro', 'convenios', 'repasses', 'suprimentos', 'admin', 'ia',
  ],
  odontologica: [
    'agenda', 'prontuarios', 'documentos', 'odontologia',
    'financeiro', 'convenios', 'repasses', 'suprimentos', 'admin', 'ia',
  ],
  estetica: [
    'agenda', 'prontuarios', 'documentos',
    'financeiro', 'repasses', 'marketing', 'admin', 'ia',
  ],
  fisioterapia: [
    'agenda', 'prontuarios', 'teleconsulta', 'documentos',
    'financeiro', 'convenios', 'repasses', 'admin', 'ia',
  ],
  psicologia: [
    'agenda', 'prontuarios', 'teleconsulta', 'documentos',
    'financeiro', 'repasses', 'admin', 'ia',
  ],
  oftalmologia: [
    'agenda', 'prontuarios', 'documentos',
    'financeiro', 'convenios', 'repasses', 'suprimentos', 'admin', 'ia',
  ],
  pediatria: [
    'agenda', 'prontuarios', 'teleconsulta', 'documentos',
    'financeiro', 'convenios', 'repasses', 'admin', 'ia',
  ],
  multidisciplinar: [
    'agenda', 'prontuarios', 'teleconsulta', 'documentos', 'odontologia',
    'financeiro', 'convenios', 'repasses', 'suprimentos', 'marketing', 'admin', 'ia',
  ],
};

/**
 * Dado um tipo de clínica, retorna o set de FeatureKeys que devem estar habilitados.
 * Junta todas as features de cada módulo ativo no preset.
 */
export function getPresetFeatures(clinicType: ClinicType): Set<FeatureKey> {
  const activeModuleKeys = CLINIC_TYPE_PRESETS[clinicType] ?? CLINIC_TYPE_PRESETS.clinica_geral;
  const features = new Set<FeatureKey>();

  for (const moduleKey of activeModuleKeys) {
    const mod = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
    if (mod) {
      for (const f of mod.features) {
        features.add(f);
      }
    }
  }

  return features;
}

/**
 * Dado um array de module keys ativados, retorna o set de FeatureKeys habilitados.
 */
export function getEnabledFeatures(enabledModules: string[]): Set<FeatureKey> {
  const features = new Set<FeatureKey>();

  for (const moduleKey of enabledModules) {
    const mod = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
    if (mod) {
      for (const f of mod.features) {
        features.add(f);
      }
    }
  }

  return features;
}
