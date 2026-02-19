// Application types derived from database schema

export type AppRole = 'admin' | 'staff';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type TransactionType = 'income' | 'expense';

export interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
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
  show_goals_progress_in_header?: boolean;
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

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
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

export interface Appointment {
  id: string;
  tenant_id: string;
  client_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  price: number;
  notes: string | null;
  source: 'internal' | 'online' | 'whatsapp' | null;
  confirmed_at: string | null;
  public_booking_token: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
  service?: Service;
  professional?: Profile;
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

export type OrderStatus = 'draft' | 'open' | 'paid' | 'cancelled' | 'refunded';
export type OrderItemKind = 'service' | 'product';
export type PaymentStatusType = 'pending' | 'paid' | 'void';

export interface Order {
  id: string;
  tenant_id: string;
  appointment_id: string;
  client_id: string | null;
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
  client?: Client;
  professional?: Profile;
  appointment?: Appointment;
}

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  kind: OrderItemKind;
  service_id: string | null;
  product_id: string | null;
  professional_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  // Joined
  service?: Service;
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
  client_id: string | null;
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
  client?: { id: string; name: string };
}
