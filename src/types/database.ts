// Application types derived from database schema

export type AppRole = 'admin' | 'staff';
export type ProfessionalType =
  | 'admin'
  | 'medico'
  | 'dentista'
  | 'enfermeiro'
  | 'tec_enfermagem'
  | 'fisioterapeuta'
  | 'nutricionista'
  | 'psicologo'
  | 'fonoaudiologo'
  | 'secretaria'
  | 'faturista'
  | 'custom';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface ResourcePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionsMap = Record<string, ResourcePermission>;

export const COUNCIL_BY_TYPE: Partial<Record<ProfessionalType, string>> = {
  medico: 'CRM',
  dentista: 'CRO',
  enfermeiro: 'COREN',
  tec_enfermagem: 'COREN',
  fisioterapeuta: 'CREFITO',
  nutricionista: 'CRN',
  psicologo: 'CRP',
  fonoaudiologo: 'CRFa',
};

export const PROFESSIONAL_TYPE_LABELS: Record<ProfessionalType, string> = {
  admin: 'Administrador',
  medico: 'Médico(a)',
  dentista: 'Dentista',
  enfermeiro: 'Enfermeiro(a)',
  tec_enfermagem: 'Téc. Enfermagem',
  fisioterapeuta: 'Fisioterapeuta',
  nutricionista: 'Nutricionista',
  psicologo: 'Psicólogo(a)',
  fonoaudiologo: 'Fonoaudiólogo(a)',
  secretaria: 'Secretária / Recepcionista',
  faturista: 'Faturista',
  custom: 'Perfil Customizado',
};
export type AppointmentStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled';
export type TransactionType = 'income' | 'expense';

export interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  product?: 'clinic';
  billing_cpf_cnpj?: string | null;
  online_booking_enabled?: boolean;
  online_booking_slug?: string | null;
  online_booking_min_lead_minutes?: number;
  online_booking_cancel_min_lead_minutes?: number;
  default_commission_percent?: number | null;
  cashback_enabled?: boolean;
  cashback_percent?: number;
  asaas_api_key?: string | null;
  asaas_environment?: string | null;
  gamification_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  allowed_product?: 'clinic';
  show_goals_progress_in_header?: boolean;
  show_gamification_popups?: boolean;
  professional_type: ProfessionalType;
  council_type: string | null;
  council_number: string | null;
  council_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: AppRole;
  created_at: string;
}

export interface Patient {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  cpf: string | null;
  access_code: string | null;
  date_of_birth: string | null;
  marital_status: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  allergies: string | null;
  insurance_plan_id: string | null;
  insurance_card_number: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Patient instead */
export type Client = Patient;

export interface ConsentTemplate {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  body_html: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  template_type: "html" | "pdf";
  pdf_storage_path: string | null;
  pdf_original_filename: string | null;
  pdf_file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface PatientConsent {
  id: string;
  tenant_id: string;
  patient_id: string;
  template_id: string;
  patient_user_id: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  facial_photo_path: string | null;
  template_snapshot_html: string | null;
}

export interface Procedure {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Procedure instead */
export type Service = Procedure;


export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  cost: number;
  quantity: number;
  min_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ConsultationType = 'primeira' | 'retorno' | 'urgencia' | 'procedimento' | 'exame';

export interface InsurancePlan {
  id: string;
  tenant_id: string;
  name: string;
  ans_code: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  reimbursement_days: number;
  requires_authorization: boolean;
  tiss_version: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  procedure_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  price: number;
  notes: string | null;
  source: 'internal' | 'online' | 'whatsapp' | null;
  confirmed_at: string | null;
  public_booking_token: string | null;
  consultation_type: ConsultationType | null;
  insurance_plan_id: string | null;
  insurance_authorization: string | null;
  specialty_id: string | null;
  room_id: string | null;
  telemedicine: boolean;
  telemedicine_url: string | null;
  cid_code: string | null;
  booked_by_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  patient?: Patient;
  /** @deprecated Use patient instead */
  client?: Patient;
  procedure?: Procedure;
  /** @deprecated Use procedure instead */
  service?: Procedure;
  professional?: Profile;
  insurance_plan?: InsurancePlan;
}

export interface FinancialTransaction {
  id: string;
  tenant_id: string;
  appointment_id: string | null;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
}

export type StockOutReasonType = "sale" | "damaged";

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  quantity: number;
  movement_type: 'in' | 'out';
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Orders / Checkout ──────────────────────────────────────

// ─── Triagem ────────────────────────────────────────────────

export type TriageStatus = 'pendente' | 'em_atendimento' | 'concluida';
export type TriagePriority = 'emergencia' | 'urgente' | 'pouco_urgente' | 'nao_urgente';

export interface TriageRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  appointment_id: string | null;
  performed_by: string | null;
  triaged_at: string;
  priority: TriagePriority;
  status: TriageStatus;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  chief_complaint: string;
  pain_scale: number | null;
  allergies: string | null;
  current_medications: string | null;
  medical_history: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  patients?: { name: string };
  /** @deprecated Use patients instead */
  clients?: { name: string };
  profiles?: { full_name: string };
}

// ─── Prontuário Eletrônico ──────────────────────────────────

export interface MedicalRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  appointment_id: string | null;
  professional_id: string | null;
  specialty_id: string | null;
  triage_id: string | null;
  template_id: string | null;
  chief_complaint: string | null;
  anamnesis: string | null;
  physical_exam: string | null;
  diagnosis: string | null;
  cid_code: string | null;
  treatment_plan: string | null;
  prescriptions: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown>;
  record_date: string;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  patients?: { name: string };
  /** @deprecated Use patients instead */
  clients?: { name: string };
  profiles?: { full_name: string };
  triage_records?: TriageRecord;
}

// ─── Modelos de Prontuário ──────────────────────────────────

export type TemplateFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean';

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  placeholder?: string;
  options?: string;
}

export interface RecordFieldTemplate {
  id: string;
  tenant_id: string;
  specialty_id: string | null;
  name: string;
  fields: TemplateField[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  specialties?: { name: string };
}

// ─── Orders / Checkout ──────────────────────────────────────

export type OrderStatus = 'draft' | 'open' | 'paid' | 'cancelled' | 'refunded';
export type OrderItemKind = 'service' | 'product';
export type PaymentStatusType = 'pending' | 'paid' | 'void';

export interface Order {
  id: string;
  tenant_id: string;
  appointment_id: string;
  patient_id: string | null;
  professional_id: string | null;
  status: OrderStatus;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  items?: OrderItem[];
  payments?: Payment[];
  patient?: Patient;
  /** @deprecated Use patient instead */
  client?: Patient;
  professional?: Profile;
  appointment?: Appointment;
}

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  kind: OrderItemKind;
  procedure_id: string | null;
  product_id: string | null;
  professional_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  // Joined
  procedure?: Procedure;
  /** @deprecated Use procedure instead */
  service?: Procedure;
  product?: Product;
}

export interface PaymentMethod {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  payment_method_id: string;
  amount: number;
  status: PaymentStatusType;
  paid_at: string | null;
  reference: string | null;
  created_at: string;
  // Joined
  payment_method?: PaymentMethod;
}

// Dashboard stats
export interface DashboardStats {
  monthlyBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  todayAppointments: number;
  lowStockProducts: number;
  pendingAppointments: number;
}

// ─── Sistema de Comissões Avançado — Fase 31 ───────────────────────────

export type CommissionRuleType = 'default' | 'service' | 'insurance' | 'procedure' | 'sale';
export type CommissionCalculationType = 'percentage' | 'fixed' | 'tiered';

export interface CommissionTier {
  min: number;
  max: number | null;
  value: number;
}

export interface CommissionRule {
  id: string;
  tenant_id: string;
  professional_id: string;
  rule_type: CommissionRuleType;
  procedure_id: string | null;
  insurance_id: string | null;
  procedure_code: string | null;
  calculation_type: CommissionCalculationType;
  value: number;
  tier_config: CommissionTier[] | null;
  priority: number;
  is_inverted: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  procedure?: { id: string; name: string };
  /** @deprecated Use procedure instead */
  service?: { id: string; name: string };
  insurance?: { id: string; name: string };
}

// ─── Financeiro Avançado — Fase 2 ───────────────────────────

export type BillStatus = 'pending' | 'paid' | 'cancelled';
export type BillReceivableStatus = 'pending' | 'received' | 'cancelled';
export type RecurrenceType = 'weekly' | 'monthly' | 'yearly';

export interface CostCenter {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillPayable {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  due_date: string;
  category: string;
  cost_center_id: string | null;
  status: BillStatus;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  notes: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  cost_center?: CostCenter;
}

export interface BillReceivable {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  category: string;
  status: BillReceivableStatus;
  notes: string | null;
  received_at: string | null;
  received_amount: number | null;
  payment_method: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  patient?: { id: string; name: string };
  /** @deprecated Use patient instead */
  client?: { id: string; name: string };
}

export type ClinicalEvolutionType = 'medica' | 'fisioterapia' | 'fonoaudiologia' | 'nutricao' | 'psicologia' | 'enfermagem' | 'outro';

export interface ClinicalEvolution {
  id: string;
  tenant_id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  medical_record_id: string | null;
  evolution_date: string;
  evolution_type: ClinicalEvolutionType;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  cid_code: string | null;
  vital_signs: Record<string, unknown>;
  digital_hash: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  patients?: { name: string };
  /** @deprecated Use patients instead */
  clients?: { name: string };
  profiles?: { full_name: string };
}
