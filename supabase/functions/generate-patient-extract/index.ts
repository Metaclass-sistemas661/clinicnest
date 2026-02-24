import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("GENERATE-PATIENT-EXTRACT");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ExtractRequest {
  format?: "pdf" | "json";
  from_date?: string;
  to_date?: string;
}

interface Invoice {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  invoice_description: string;
  amount: number;
  payment_method: string;
  status: string;
  paid_at: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
}

function generatePdfHtml(
  patientName: string,
  tenantName: string,
  invoices: Invoice[],
  payments: Payment[],
  summary: { total_paid: number; total_pending: number; total_overdue: number }
): string {
  const now = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const invoiceRows = invoices
    .map(
      (inv) => `
      <tr>
        <td>${formatDate(inv.created_at)}</td>
        <td>${inv.description}</td>
        <td>${formatDate(inv.due_date)}</td>
        <td class="${inv.status === "paid" ? "text-green" : inv.status === "overdue" ? "text-red" : ""}">
          ${inv.status === "paid" ? "Pago" : inv.status === "overdue" ? "Vencido" : "Pendente"}
        </td>
        <td class="text-right">${formatCurrency(inv.amount)}</td>
        <td class="text-right">${inv.paid_at ? formatDate(inv.paid_at) : "-"}</td>
      </tr>
    `
    )
    .join("");

  const paymentRows = payments
    .map(
      (pay) => `
      <tr>
        <td>${formatDate(pay.paid_at)}</td>
        <td>${pay.invoice_description}</td>
        <td>${pay.payment_method || "-"}</td>
        <td class="text-right text-green">${formatCurrency(pay.amount)}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Extrato Financeiro - ${patientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #0d9488; padding-bottom: 15px; }
    .header h1 { color: #0d9488; font-size: 20px; }
    .header .clinic { text-align: right; color: #666; }
    .patient-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .patient-info h2 { font-size: 14px; margin-bottom: 5px; }
    .summary { display: flex; gap: 15px; margin-bottom: 25px; }
    .summary-card { flex: 1; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card.paid { background: #d1fae5; color: #065f46; }
    .summary-card.pending { background: #fef3c7; color: #92400e; }
    .summary-card.overdue { background: #fee2e2; color: #991b1b; }
    .summary-card .value { font-size: 18px; font-weight: bold; }
    .summary-card .label { font-size: 10px; text-transform: uppercase; }
    .section { margin-bottom: 25px; }
    .section h3 { font-size: 13px; color: #0d9488; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f3f4f6; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    .text-right { text-align: right; }
    .text-green { color: #059669; }
    .text-red { color: #dc2626; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 9px; }
    @media print {
      body { padding: 0; }
      .summary-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Extrato Financeiro</h1>
      <p>Gerado em ${now}</p>
    </div>
    <div class="clinic">
      <strong>${tenantName}</strong>
    </div>
  </div>

  <div class="patient-info">
    <h2>${patientName}</h2>
  </div>

  <div class="summary">
    <div class="summary-card paid">
      <div class="value">${formatCurrency(summary.total_paid)}</div>
      <div class="label">Total Pago</div>
    </div>
    <div class="summary-card pending">
      <div class="value">${formatCurrency(summary.total_pending)}</div>
      <div class="label">Pendente</div>
    </div>
    <div class="summary-card overdue">
      <div class="value">${formatCurrency(summary.total_overdue)}</div>
      <div class="label">Vencido</div>
    </div>
  </div>

  <div class="section">
    <h3>Faturas</h3>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Vencimento</th>
          <th>Status</th>
          <th class="text-right">Valor</th>
          <th class="text-right">Pago em</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">Nenhuma fatura encontrada</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Histórico de Pagamentos</h3>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Forma de Pagamento</th>
          <th class="text-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Nenhum pagamento encontrado</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Este documento é um extrato financeiro gerado automaticamente pelo sistema ClinicNest.</p>
    <p>Em caso de dúvidas, entre em contato com a clínica.</p>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUserWithTenant(req, cors);
  if (authResult.error) return authResult.error;
  const { user, tenantId } = authResult;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body: ExtractRequest = await req.json().catch(() => ({}));
    const { format = "pdf" } = body;

    log("Gerando extrato financeiro", { userId: user.id, tenantId, format });

    // Buscar dados do paciente (cliente vinculado ao user)
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, email")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (patientError || !patient) {
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome da clínica
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    // Buscar faturas do paciente
    const { data: invoices } = await supabaseAdmin
      .from("patient_invoices")
      .select("id, description, amount, due_date, status, paid_at, paid_amount, payment_method, created_at")
      .eq("patient_id", patient.id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Buscar histórico de pagamentos
    const { data: payments } = await (supabaseAdmin as any).rpc("get_patient_payment_history_admin", {
      p_patient_id: patient.id,
      p_tenant_id: tenantId,
      p_limit: 100,
      p_offset: 0,
    });

    // Calcular resumo
    const summary = {
      total_paid: 0,
      total_pending: 0,
      total_overdue: 0,
    };

    (invoices || []).forEach((inv: Invoice) => {
      if (inv.status === "paid") {
        summary.total_paid += inv.paid_amount || inv.amount;
      } else if (inv.status === "overdue") {
        summary.total_overdue += inv.amount;
      } else if (inv.status === "pending") {
        summary.total_pending += inv.amount;
      }
    });

    if (format === "json") {
      return new Response(
        JSON.stringify({
          success: true,
          patient: { name: patient.name, email: patient.email },
          tenant: { name: tenant?.name || "Clínica" },
          summary,
          invoices: invoices || [],
          payments: payments || [],
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Gerar HTML do PDF
    const html = generatePdfHtml(
      patient.name,
      tenant?.name || "Clínica",
      (invoices || []) as Invoice[],
      (payments || []) as Payment[],
      summary
    );

    // Converter HTML para PDF usando serviço externo ou retornar HTML
    // Por simplicidade, retornamos o HTML que pode ser impresso como PDF pelo navegador
    // Em produção, usar um serviço como Puppeteer, wkhtmltopdf, ou API de PDF

    // Opção 1: Retornar HTML para impressão
    const htmlBase64 = btoa(unescape(encodeURIComponent(html)));

    log("Extrato gerado com sucesso", { patientId: patient.id });

    return new Response(
      JSON.stringify({
        success: true,
        html_base64: htmlBase64,
        message: "Abra o HTML e use Ctrl+P para salvar como PDF",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
