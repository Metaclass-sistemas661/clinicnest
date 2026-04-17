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

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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

// ── CPF Validation (Brazilian digit-check algorithm) ───────────

export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Reject all-same-digit CPFs
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * w1[i];
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * w2[i];
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(digits[10]);
}

// ── Schemas ────────────────────────────────────────────────────

const cpfValidator = z.string().min(1, "CPF é obrigatório").refine(
  (val) => isValidCpf(val),
  { message: "CPF inválido" },
);

const phoneValidator = z.string().min(1, "Telefone é obrigatório").refine(
  (val) => {
    const digits = val.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
  },
  { message: "Telefone deve conter 10 ou 11 dígitos (com DDD)" },
);

export const patientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  phone: phoneValidator,
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
  cpf: cpfValidator,
  date_of_birth: z.string().min(1, "Data de nascimento é obrigatória"),
  marital_status: z.string().optional(),
  zip_code: z.string().min(1, "CEP é obrigatório"),
  street: z.string().min(1, "Logradouro é obrigatório"),
  street_number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado é obrigatório"),
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
