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
  sale_price: number;
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
  product_id: string | null;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

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

// Dashboard stats
export interface DashboardStats {
  monthlyBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  todayAppointments: number;
  lowStockProducts: number;
  pendingAppointments: number;
}
