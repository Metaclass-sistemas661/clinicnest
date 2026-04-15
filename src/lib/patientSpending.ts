import { api } from "@/integrations/gcp/client";
import { format } from "date-fns";
import { formatInAppTz } from "./date";

export interface PatientSpendingRow {
  patient_id: string;
  patient_name: string;
  services_count: number;
  products_count: number;
  total_amount: number;
  /** Ticket médio = total / visitas (procedimentos realizados). Se 0 visitas, usa total. */
  ticket_medio: number;
  /** Procedimentos realizados (nome, valor, data) */
  services_detail: { name: string; amount: number; date: string }[];
  /** Produtos comprados (nome, valor, data) */
  products_detail: { name: string; amount: number; date: string }[];
}

/** @deprecated Use PatientSpendingRow instead */
export type ClientSpendingRow = PatientSpendingRow;

export interface PatientSpendingByPeriod {
  patient_id: string;
  patient_name: string;
  today_total: number;
  month_total: number;
}

/** @deprecated Use PatientSpendingByPeriod instead */
export type ClientSpendingByPeriod = PatientSpendingByPeriod;

/**
 * Fetch patient spending (services + products) from income transactions
 * linked to appointments. Groups by patient_id.
 */
export async function fetchPatientSpendingAllTime(
  tenantId: string
): Promise<PatientSpendingRow[]> {
  const { data, error } = await api
    .from("financial_transactions")
    .select(
      `
      amount,
      category,
      transaction_date,
      appointments(patient_id, patients(id, name), procedure_id, procedure:procedures(name))
    `
    )
    .eq("tenant_id", tenantId)
    .eq("type", "income")
    .not("appointment_id", "is", null);

  if (error) throw error;

  type Acc = {
    name: string;
    procedures: number;
    products: number;
    total: number;
    procedures_detail: { name: string; amount: number; date: string }[];
    products_detail: { name: string; amount: number; date: string }[];
  };

  const byPatient = new Map<string, Acc>();

  for (const row of data || []) {
    const apt = row.appointments as {
      patient_id: string | null;
      patients?: { id: string; name: string } | null;
      procedure?: { name: string } | null;
    } | null;
    if (!apt?.patient_id || !apt?.patients) continue;

    const id = apt.patient_id;
    const name = apt.patients.name;
    const amount = Number(row.amount) || 0;
    const date = String(row.transaction_date || "");

    if (!byPatient.has(id)) {
      byPatient.set(id, {
        name,
        procedures: 0,
        products: 0,
        total: 0,
        procedures_detail: [],
        products_detail: [],
      });
    }
    const cur = byPatient.get(id)!;
    cur.total += amount;

    if (row.category === "Procedimento") {
      cur.procedures += 1;
      cur.procedures_detail.push({
        name: apt.procedure?.name ?? "Procedimento",
        amount,
        date,
      });
    } else if (row.category === "Venda de Produto") {
      cur.products += 1;
      cur.products_detail.push({
        name: "Produto",
        amount,
        date,
      });
    }
  }

  return Array.from(byPatient.entries())
    .map(([patient_id, v]) => {
      const visits = v.procedures;
      const ticketMedio = visits > 0 ? v.total / visits : v.total;
      return {
        patient_id,
        patient_name: v.name,
        services_count: v.procedures,
        products_count: v.products,
        total_amount: v.total,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        services_detail: v.procedures_detail,
        products_detail: v.products_detail,
      };
    })
    .sort((a, b) => b.total_amount - a.total_amount);
}

/** @deprecated Use fetchPatientSpendingAllTime instead */
export const fetchClientSpendingAllTime = fetchPatientSpendingAllTime;

/**
 * Fetch patient spending for today and current month.
 * Returns sorted by month_total descending.
 */
export async function fetchPatientSpendingByPeriod(
  tenantId: string
): Promise<PatientSpendingByPeriod[]> {
  const today = new Date();
  const todayStr = formatInAppTz(today, "yyyy-MM-dd");
  const monthStart = format(today, "yyyy-MM-01");
  const monthEnd = format(today, "yyyy-MM-dd");

  const { data, error } = await api
    .from("financial_transactions")
    .select(
      `
      amount,
      transaction_date,
      appointments(patient_id, patients(id, name))
    `
    )
    .eq("tenant_id", tenantId)
    .eq("type", "income")
    .not("appointment_id", "is", null)
    .gte("transaction_date", monthStart)
    .lte("transaction_date", monthEnd);

  if (error) throw error;

  const byPatient = new Map<
    string,
    { name: string; today: number; month: number }
  >();

  for (const row of data || []) {
    const apt = row.appointments as { patient_id: string | null; patients?: { id: string; name: string } | null } | null;
    if (!apt?.patient_id || !apt?.patients) continue;

    const id = apt.patient_id;
    const name = apt.patients.name;
    const amount = Number(row.amount) || 0;
    const date = String(row.transaction_date || "");

    if (!byPatient.has(id)) {
      byPatient.set(id, { name, today: 0, month: 0 });
    }
    const cur = byPatient.get(id)!;
    cur.month += amount;
    if (date === todayStr) cur.today += amount;
  }

  return Array.from(byPatient.entries())
    .map(([patient_id, v]) => ({
      patient_id,
      patient_name: v.name,
      today_total: v.today,
      month_total: v.month,
    }))
    .sort((a, b) => b.month_total - a.month_total);
}

/** @deprecated Use fetchPatientSpendingByPeriod instead */
export const fetchClientSpendingByPeriod = fetchPatientSpendingByPeriod;
