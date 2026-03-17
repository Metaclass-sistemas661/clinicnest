import { z } from "zod";
import type { Patient } from "@/types/database";
import type { PatientSpendingRow } from "@/lib/patientSpending";

// ── Constants ──────────────────────────────────────────────────

export const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const MARITAL_STATUS_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

// ── Formatters ─────────────────────────────────────────────────

export const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const formatDate = (d: string) => {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

// ── Schemas ────────────────────────────────────────────────────

export const patientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  phone: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
  cpf: z.string().optional(),
  date_of_birth: z.string().optional(),
  marital_status: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  street_number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});

export const packageFormSchema = z.object({
  procedure_id: z.string().min(1, "Selecione um procedimento"),
  total_sessions: z.coerce.number().int().min(1, "Mínimo 1 sessão").max(100, "Máximo 100 sessões"),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
});

// ── Form Data ──────────────────────────────────────────────────

export const emptyFormData = {
  name: "", phone: "", email: "", cpf: "", date_of_birth: "",
  marital_status: "", zip_code: "", street: "", street_number: "",
  complement: "", neighborhood: "", city: "", state: "", allergies: "", notes: "",
};

export type PatientFormData = typeof emptyFormData;

// ── Shared Types ───────────────────────────────────────────────

export interface PatientPackage {
  id: string;
  procedure_id: string;
  service_name: string;
  total_sessions: number;
  remaining_sessions: number;
  status: string;
  purchased_at: string;
  expires_at: string | null;
}

export interface ClinicalHistoryItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string;
}

export function patientToFormData(patient: Patient): PatientFormData {
  return {
    name: patient.name,
    phone: patient.phone || "",
    email: patient.email || "",
    cpf: patient.cpf || "",
    date_of_birth: patient.date_of_birth || "",
    marital_status: patient.marital_status || "",
    zip_code: patient.zip_code || "",
    street: patient.street || "",
    street_number: patient.street_number || "",
    complement: patient.complement || "",
    neighborhood: patient.neighborhood || "",
    city: patient.city || "",
    state: patient.state || "",
    allergies: patient.allergies || "",
    notes: patient.notes || "",
  };
}
