import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatInAppTz } from "./date";

export interface ClientSpendingRow {
  client_id: string;
  client_name: string;
  services_count: number;
  products_count: number;
  total_amount: number;
}

export interface ClientSpendingByPeriod {
  client_id: string;
  client_name: string;
  today_total: number;
  month_total: number;
}

/**
 * Fetch client spending (services + products) from income transactions
 * linked to appointments. Groups by client_id.
 */
export async function fetchClientSpendingAllTime(
  tenantId: string
): Promise<ClientSpendingRow[]> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select(
      `
      amount,
      category,
      appointments(client_id, clients(id, name))
    `
    )
    .eq("tenant_id", tenantId)
    .eq("type", "income")
    .not("appointment_id", "is", null);

  if (error) throw error;

  const byClient = new Map<
    string,
    { name: string; services: number; products: number; total: number }
  >();

  for (const row of data || []) {
    const apt = row.appointments as { client_id: string | null; clients?: { id: string; name: string } | null } | null;
    if (!apt?.client_id || !apt?.clients) continue;

    const id = apt.client_id;
    const name = apt.clients.name;
    const amount = Number(row.amount) || 0;

    if (!byClient.has(id)) {
      byClient.set(id, { name, services: 0, products: 0, total: 0 });
    }
    const cur = byClient.get(id)!;
    cur.total += amount;
    if (row.category === "Serviço") cur.services += 1;
    else if (row.category === "Venda de Produto") cur.products += 1;
  }

  return Array.from(byClient.entries())
    .map(([client_id, v]) => ({
      client_id,
      client_name: v.name,
      services_count: v.services,
      products_count: v.products,
      total_amount: v.total,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);
}

/**
 * Fetch client spending for today and current month.
 * Returns sorted by month_total descending.
 */
export async function fetchClientSpendingByPeriod(
  tenantId: string
): Promise<ClientSpendingByPeriod[]> {
  const today = new Date();
  const todayStr = formatInAppTz(today, "yyyy-MM-dd");
  const monthStart = format(today, "yyyy-MM-01");
  const monthEnd = format(today, "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("financial_transactions")
    .select(
      `
      amount,
      transaction_date,
      appointments(client_id, clients(id, name))
    `
    )
    .eq("tenant_id", tenantId)
    .eq("type", "income")
    .not("appointment_id", "is", null)
    .gte("transaction_date", monthStart)
    .lte("transaction_date", monthEnd);

  if (error) throw error;

  const byClient = new Map<
    string,
    { name: string; today: number; month: number }
  >();

  for (const row of data || []) {
    const apt = row.appointments as { client_id: string | null; clients?: { id: string; name: string } | null } | null;
    if (!apt?.client_id || !apt?.clients) continue;

    const id = apt.client_id;
    const name = apt.clients.name;
    const amount = Number(row.amount) || 0;
    const date = String(row.transaction_date || "");

    if (!byClient.has(id)) {
      byClient.set(id, { name, today: 0, month: 0 });
    }
    const cur = byClient.get(id)!;
    cur.month += amount;
    if (date === todayStr) cur.today += amount;
  }

  return Array.from(byClient.entries())
    .map(([client_id, v]) => ({
      client_id,
      client_name: v.name,
      today_total: v.today,
      month_total: v.month,
    }))
    .sort((a, b) => b.month_total - a.month_total);
}
