import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

type Json = Record<string, unknown>;

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function toIsoDate(d: Date): string {
  // yyyy-mm-dd
  return d.toISOString().slice(0, 10);
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDateBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sum(numbers: Array<number | null | undefined>): number {
  return numbers.reduce<number>((acc, v) => acc + Number(v ?? 0), 0);
}

function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getRemoteBrowserWSEndpoint(): string | null {
  return (
    process.env.BROWSERLESS_WS_ENDPOINT ??
    process.env.CHROME_WS_ENDPOINT ??
    process.env.PUPPETEER_WS_ENDPOINT ??
    null
  );
}

function sanitizeWsEndpoint(endpoint: string | null):
  | { present: false }
  | { present: true; origin: string; hasTokenParam: boolean } {
  if (!endpoint) return { present: false };
  try {
    const u = new URL(endpoint);
    return {
      present: true,
      origin: `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}`,
      hasTokenParam: u.searchParams.has("token"),
    };
  } catch {
    return {
      present: true,
      origin: "(invalid url)",
      hasTokenParam: endpoint.includes("token="),
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Diagnostics mode (useful when Vercel runtime logs are not visible).
    // Runs without auth/token to avoid leaking sessions while troubleshooting.
    if (String((req.query as any)?.debug ?? "") === "1") {
      const remoteWsEndpoint = getRemoteBrowserWSEndpoint();
      const executablePath = await chromium.executablePath();

      const extractedBaseDir = path.dirname(executablePath); // e.g. /tmp
      const extractedChromiumDir = path.join(extractedBaseDir, "chromium");
      const libPaths = [
        path.join(extractedChromiumDir, "lib"),
        path.join(extractedChromiumDir, "lib64"),
        path.join(extractedBaseDir, "lib"),
        path.join(extractedBaseDir, "lib64"),
        "/tmp/lib",
        "/tmp/lib64",
        "/usr/lib64",
        "/usr/lib",
        "/lib64",
        "/lib",
      ];
      const currentLd = process.env.LD_LIBRARY_PATH;
      const nextLd = [...libPaths, currentLd].filter(Boolean).join(":");
      process.env.LD_LIBRARY_PATH = nextLd;

      const probePaths = [
        "/tmp/lib/libnss3.so",
        "/tmp/lib64/libnss3.so",
        "/tmp/chromium/lib/libnss3.so",
        "/tmp/chromium/lib64/libnss3.so",
        "/usr/lib/libnss3.so",
        "/usr/lib64/libnss3.so",
        "/lib/libnss3.so",
        "/lib64/libnss3.so",
      ];

      res.status(200).json({
        ok: false,
        debug: true,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        remoteBrowser: sanitizeWsEndpoint(remoteWsEndpoint),
        executablePath,
        extractedBaseDir,
        ldLibraryPath: process.env.LD_LIBRARY_PATH,
        libProbe: probePaths.map((p) => ({ path: p, exists: exists(p) })),
      });
      return;
    }

    const token = parseBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing Authorization Bearer token" });
      return;
    }

    const { startDate, endDate } = (req.body ?? {}) as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      res.status(400).json({ error: "Missing startDate or endDate" });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      res.status(400).json({ error: "Invalid startDate/endDate" });
      return;
    }

    const salaryRefMonth = start.getMonth() + 1;
    const salaryRefYear = start.getFullYear();

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      res.status(401).json({ error: "Invalid user session" });
      return;
    }

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile?.tenant_id) {
      res.status(403).json({ error: "Profile/tenant not found" });
      return;
    }

    const tenantId = profile.tenant_id as string;
    const tenantLabel = profile.full_name ? `Relatório de ${profile.full_name}` : "Relatório Financeiro";

    // Feature gating: PDF export is available only for Pro/Premium.
    try {
      const { data: hasPdf, error: hasPdfError } = await supabaseAdmin.rpc("tenant_has_feature", {
        p_tenant_id: tenantId,
        p_feature: "pdf_export",
      });
      if (hasPdfError) throw hasPdfError;

      if (!hasPdf) {
        res.status(403).json({
          error: "Exportação em PDF disponível apenas nos planos Pro e Premium.",
          code: "premium_required",
          cta: {
            label: "Fazer upgrade",
            href: "/assinatura",
          },
          details: {
            feature: "pdf_export",
            required_tier: "pro",
          },
        });
        return;
      }
    } catch {
      // Fail-safe: if we can't check plan due to infra errors, do not block PDF generation.
      // (We prefer availability over false negative blocks.)
    }

    const startDateOnly = toIsoDate(start);
    const endDateOnly = toIsoDate(end);

    const [
      transactionsResult,
      commissionsResult,
      damagedResult,
      salaryPaidResult,
      professionalsWithSalaryResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("financial_transactions")
        .select("id,tenant_id,appointment_id,type,category,amount,description,transaction_date")
        .eq("tenant_id", tenantId)
        .gte("transaction_date", startDateOnly)
        .lte("transaction_date", endDateOnly)
        .order("transaction_date", { ascending: false }),
      supabaseAdmin
        .from("commission_payments")
        .select(
          `id,tenant_id,professional_id,amount,service_price,commission_type,status,created_at,payment_date,professional:profiles!commission_payments_professional_id_fkey(full_name)`
        )
        .eq("tenant_id", tenantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("stock_movements")
        .select(
          `id,product_id,quantity,reason,created_at,movement_type,out_reason_type,product:products(name,cost)`
        )
        .eq("tenant_id", tenantId)
        .eq("movement_type", "out")
        .eq("out_reason_type", "damaged")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
      // Paid salaries in selected month/year via RPC (source of truth)
      supabaseAdmin.rpc("get_salary_payments", {
        p_tenant_id: tenantId,
        p_professional_id: null,
        p_year: salaryRefYear,
        p_month: salaryRefMonth,
      }),
      supabaseAdmin.rpc("get_professionals_with_salary", { p_tenant_id: tenantId }),
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (commissionsResult.error) throw commissionsResult.error;
    if (damagedResult.error) throw damagedResult.error;
    if (salaryPaidResult.error) throw salaryPaidResult.error;
    if (professionalsWithSalaryResult.error) throw professionalsWithSalaryResult.error;

    const transactions = (transactionsResult.data ?? []) as Array<{
      id: string;
      appointment_id: string | null;
      type: "income" | "expense";
      category: string;
      amount: number;
      description: string | null;
      transaction_date: string;
    }>;

    // Supabase join fields can come as arrays depending on relationship/cardinality.
    // Normalize here to keep types stable for the PDF template.
    const commissions = ((commissionsResult.data ?? []) as Array<{
      id: any;
      professional_id: any;
      amount: any;
      service_price: any;
      commission_type: any;
      status: any;
      created_at: any;
      payment_date?: any;
      professional?: Array<{ full_name: any }> | { full_name: any } | null;
    }>).map((c) => {
      const prof = Array.isArray(c.professional) ? c.professional[0] : c.professional;
      return {
        id: String(c.id),
        professional_id: String(c.professional_id),
        professional: prof?.full_name ? { full_name: String(prof.full_name) } : null,
        amount: Number(c.amount) || 0,
        service_price: Number(c.service_price) || 0,
        commission_type: (c.commission_type as "percentage" | "fixed") ?? "fixed",
        status: (c.status as "pending" | "paid" | "cancelled") ?? "pending",
        created_at: String(c.created_at),
        payment_date: c.payment_date ? String(c.payment_date) : null,
      };
    });

    const damagedLosses = ((damagedResult.data ?? []) as Array<{
      id: any;
      quantity: any;
      reason: any;
      created_at: any;
      product?: Array<{ name: any; cost: any }> | { name: any; cost: any } | null;
    }>).map((m) => {
      const product = Array.isArray(m.product) ? m.product[0] : m.product;
      return {
        id: String(m.id),
        quantity: Number(m.quantity) || 0,
        reason: m.reason ? String(m.reason) : null,
        created_at: String(m.created_at),
        product: product?.name
          ? { name: String(product.name), cost: Number(product.cost) || 0 }
          : null,
      };
    });

    const salaryPaid = (salaryPaidResult.data ?? []) as Array<{
      id: string;
      professional_id: string;
      professional_name: string;
      payment_month: number;
      payment_year: number;
      amount: number;
      status: string;
      payment_date: string | null;
      payment_method: string | null;
      payment_reference: string | null;
      notes: string | null;
    }>;

    const professionalsWithSalary = (professionalsWithSalaryResult.data ?? []) as Array<{
      professional_id: string;
      professional_name: string;
      salary_amount: number;
      default_payment_method: string | null;
    }>;

    const incomeTotal = sum(transactions.filter((t) => t.type === "income").map((t) => Number(t.amount)));
    const expenseTotal = sum(transactions.filter((t) => t.type === "expense").map((t) => Number(t.amount)));
    const balance = incomeTotal - expenseTotal;

    const productLossTotal = sum(
      damagedLosses.map((m) => {
        const qty = Math.abs(Number(m.quantity) || 0);
        const unit = Number(m.product?.cost ?? 0);
        return qty * unit;
      })
    );

    const commissionsPaidTotal = sum(commissions.filter((c) => c.status === "paid").map((c) => Number(c.amount)));
    const commissionsPendingTotal = sum(commissions.filter((c) => c.status === "pending").map((c) => Number(c.amount)));

    const paidSalaryTotal = sum(salaryPaid.filter((s) => s.status === "paid").map((s) => Number(s.amount)));
    const paidIds = new Set(
      salaryPaid
        .filter((s) => s.status === "paid")
        .map((s) => s.professional_id)
        .filter(Boolean)
    );
    const pendingSalaryTotal = sum(
      professionalsWithSalary
        .filter((p) => p.professional_id && !paidIds.has(p.professional_id))
        .map((p) => Number(p.salary_amount || 0))
    );

    const balanceTone = balance >= 0 ? "pos" : "neg";
    const generatedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório Financeiro</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 18mm 14mm; }
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e5e7eb;
      --surface: #ffffff;
      --bg: #f8fafc;
      --brand: #7c3aed;
      --brand-2: #4f46e5;
      --pos: #16a34a;
      --neg: #dc2626;
      --shadow: 0 10px 28px rgba(2, 6, 23, 0.06);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sheet {
      width: 100%;
    }

    .hero {
      border: 1px solid rgba(255,255,255,.35);
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      color: #fff;
      border-radius: 16px;
      padding: 18px 18px 16px 18px;
      box-shadow: var(--shadow);
    }
    .heroTop { display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; }
    .brand { font-weight: 800; letter-spacing: .2px; font-size: 16px; line-height: 1.15; }
    .reportTitle { margin-top: 6px; font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
    .heroMeta { text-align:right; font-size: 11px; opacity: .95; }
    .heroMeta strong { display:block; font-size: 12px; }
    .heroSub { margin-top: 10px; font-size: 11px; opacity: .95; }

    .section { margin-top: 16px; }
    .sectionHeader { display:flex; align-items:baseline; justify-content:space-between; gap: 12px; margin-bottom: 8px; }
    .h2 { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin: 0; }
    .hint { font-size: 10px; color: rgba(100,116,139,.95); }

    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px 12px;
      background: var(--surface);
      box-shadow: 0 1px 0 rgba(2, 6, 23, 0.03);
    }
    .card .label { font-size: 10px; letter-spacing: .10em; color: var(--muted); font-weight: 800; text-transform: uppercase; }
    .card .value { margin-top: 6px; font-size: 18px; font-weight: 900; letter-spacing: -.01em; }
    .card .sub { margin-top: 4px; font-size: 10px; color: var(--muted); }
    .value.pos { color: var(--pos); }
    .value.neg { color: var(--neg); }

    .kpiRow { display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }

    .pill { display:inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
    .pill.ok { background: rgba(34,197,94,.12); color: #166534; border: 1px solid rgba(34,197,94,.25); }
    .pill.bad { background: rgba(239,68,68,.10); color: #991b1b; border: 1px solid rgba(239,68,68,.22); }

    .tableWrap { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #f1f5f9;
      text-align:left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .10em;
      padding: 9px 10px;
      color: #475569;
      border-bottom: 1px solid var(--line);
    }
    tbody td {
      padding: 9px 10px;
      font-size: 11px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #fafafa; }
    tbody tr:last-child td { border-bottom: none; }
    .right { text-align:right; font-variant-numeric: tabular-nums; }
    .mono { font-variant-numeric: tabular-nums; }

    .note { margin-top: 8px; font-size: 10px; color: var(--muted); }
    .pageBreak { page-break-before: always; }

    /* Avoid breaking inside cards/tables when possible */
    .card, .tableWrap { break-inside: avoid; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div class="heroTop">
        <div>
          <div class="brand">BeautyGest</div>
          <div class="reportTitle">Relatório Financeiro</div>
        </div>
        <div class="heroMeta">
          <strong>${escapeHtml(tenantLabel)}</strong>
          <span class="mono">${escapeHtml(formatDateBR(start))} a ${escapeHtml(formatDateBR(end))}</span>
        </div>
      </div>
      <div class="heroSub">Resumo executivo, salários, comissões, perdas e transações do período selecionado.</div>
    </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Resumo Executivo</div>
      <div class="hint">Valores em BRL</div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="label">Saldo</div>
        <div class="value ${balanceTone}">${escapeHtml(formatCurrencyBRL(balance))}</div>
        <div class="sub">${balance >= 0 ? "Resultado positivo" : "Resultado negativo"}</div>
      </div>
      <div class="card">
        <div class="label">Receitas</div>
        <div class="value pos">${escapeHtml(formatCurrencyBRL(incomeTotal))}</div>
        <div class="sub">No período</div>
      </div>
      <div class="card">
        <div class="label">Despesas</div>
        <div class="value neg">${escapeHtml(formatCurrencyBRL(expenseTotal))}</div>
        <div class="sub">No período</div>
      </div>
      <div class="card">
        <div class="label">Perdas (danificados)</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(productLossTotal))}</div>
        <div class="sub">No período</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Comissões</div>
      <div class="hint">Pagas vs. pendentes</div>
    </div>
    <div class="kpiRow">
      <div class="card">
        <div class="label">Pagas</div>
        <div class="value pos">${escapeHtml(formatCurrencyBRL(commissionsPaidTotal))}</div>
      </div>
      <div class="card">
        <div class="label">Pendentes</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(commissionsPendingTotal))}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Salários</div>
      <div class="hint">Mês ref.: ${salaryRefMonth}/${salaryRefYear}</div>
    </div>
    <div class="kpiRow">
      <div class="card">
        <div class="label">Pagos</div>
        <div class="value pos">${escapeHtml(formatCurrencyBRL(paidSalaryTotal))}</div>
      </div>
      <div class="card">
        <div class="label">Pendentes</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(pendingSalaryTotal))}</div>
      </div>
    </div>

    <div style="margin-top:10px">
      <div class="sectionHeader" style="margin: 14px 0 8px 0">
        <div class="h2" style="font-size: 11px">Detalhamento</div>
        <div class="hint">Pagos</div>
      </div>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Mês/Ano</th>
              <th>Status</th>
              <th class="right">Valor</th>
              <th>Data pgto</th>
              <th>Forma</th>
            </tr>
          </thead>
          <tbody>
            ${salaryPaid
              .filter((s) => s.status === "paid")
              .map((s) => {
                const statusPill = `<span class="pill ok">Pago</span>`;
                const paymentDate = s.payment_date ? escapeHtml(formatDateBR(new Date(s.payment_date))) : "—";
                return `<tr>
                  <td>${escapeHtml(s.professional_name || "—")}</td>
                  <td>${escapeHtml(String(s.payment_month))}/${escapeHtml(String(s.payment_year))}</td>
                  <td>${statusPill}</td>
                  <td class="right">${escapeHtml(formatCurrencyBRL(Number(s.amount)))}</td>
                  <td>${paymentDate}</td>
                  <td>${escapeHtml(s.payment_method || "—")}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="note">
        Observação: salários pendentes são calculados a partir dos profissionais com salário configurado que ainda não constam como pagos no mês de referência.
      </div>
    </div>

    <div style="margin-top:10px">
      <div class="sectionHeader" style="margin: 14px 0 8px 0">
        <div class="h2" style="font-size: 11px">Pendentes</div>
        <div class="hint">Profissionais com salário configurado</div>
      </div>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Mês/Ano</th>
              <th>Status</th>
              <th class="right">Valor</th>
              <th>Data pgto</th>
              <th>Forma</th>
            </tr>
          </thead>
          <tbody>
            ${professionalsWithSalary
              .filter((p) => p.professional_id && !paidIds.has(p.professional_id) && Number(p.salary_amount || 0) > 0)
              .map((p) => {
                const statusPill = `<span class="pill bad">Pendente</span>`;
                return `<tr>
                  <td>${escapeHtml(p.professional_name || "—")}</td>
                  <td>${escapeHtml(String(salaryRefMonth))}/${escapeHtml(String(salaryRefYear))}</td>
                  <td>${statusPill}</td>
                  <td class="right">${escapeHtml(formatCurrencyBRL(Number(p.salary_amount)))}</td>
                  <td>—</td>
                  <td>${escapeHtml(p.default_payment_method || "—")}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Receitas</div>
      <div class="hint">Transações de entrada no período</div>
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th style="width: 88px">Data</th>
            <th style="width: 110px">Categoria</th>
            <th>Descrição</th>
            <th class="right" style="width: 92px">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${transactions
            .filter((t) => t.type === "income")
            .slice(0, 120)
            .map((t) => {
              const d = new Date(t.transaction_date);
              const signed = "+" + formatCurrencyBRL(Number(t.amount));
              return `<tr>
                <td>${escapeHtml(formatDateBR(d))}</td>
                <td>${escapeHtml(t.category || "—")}</td>
                <td>${escapeHtml(t.description || "—")}</td>
                <td class="right">${escapeHtml(signed)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Despesas</div>
      <div class="hint">Transações de saída no período</div>
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th style="width: 88px">Data</th>
            <th style="width: 110px">Categoria</th>
            <th>Descrição</th>
            <th class="right" style="width: 92px">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${transactions
            .filter((t) => t.type === "expense")
            .slice(0, 120)
            .map((t) => {
              const d = new Date(t.transaction_date);
              const signed = "-" + formatCurrencyBRL(Number(t.amount));
              return `<tr>
                <td>${escapeHtml(formatDateBR(d))}</td>
                <td>${escapeHtml(t.category || "—")}</td>
                <td>${escapeHtml(t.description || "—")}</td>
                <td class="right">${escapeHtml(signed)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="note">Mostrando até 120 linhas por seção para manter o PDF leve.</div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Perdas (danificados)</div>
      <div class="hint">Saídas por dano</div>
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th style="width: 88px">Data</th>
            <th>Produto</th>
            <th class="right" style="width: 72px">Qtd</th>
            <th class="right" style="width: 92px">Custo</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          ${damagedLosses
            .slice(0, 80)
            .map((m) => {
              const d = new Date(m.created_at);
              return `<tr>
                <td>${escapeHtml(formatDateBR(d))}</td>
                <td>${escapeHtml(m.product?.name || "—")}</td>
                <td class="right">${escapeHtml(String(Math.abs(Number(m.quantity) || 0)))}</td>
                <td class="right">${escapeHtml(formatCurrencyBRL(Number(m.product?.cost ?? 0)))}</td>
                <td>${escapeHtml(m.reason || "—")}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Comissões pagas</div>
      <div class="hint">Pagamentos efetivados</div>
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th style="width: 88px">Data</th>
            <th>Profissional</th>
            <th>Status</th>
            <th class="right" style="width: 92px">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${commissions
            .filter((c) => c.status === "paid")
            .slice(0, 100)
            .map((c) => {
              const d = new Date(c.payment_date || c.created_at);
              return `<tr>
                <td>${escapeHtml(formatDateBR(d))}</td>
                <td>${escapeHtml(c.professional?.full_name || "—")}</td>
                <td><span class="pill ok">Pago</span></td>
                <td class="right">${escapeHtml(formatCurrencyBRL(Number(c.amount)))}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="sectionHeader">
      <div class="h2">Comissões pendentes</div>
      <div class="hint">A liquidar</div>
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th style="width: 88px">Data</th>
            <th>Profissional</th>
            <th>Status</th>
            <th class="right" style="width: 92px">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${commissions
            .filter((c) => c.status === "pending")
            .slice(0, 100)
            .map((c) => {
              const d = new Date(c.created_at);
              return `<tr>
                <td>${escapeHtml(formatDateBR(d))}</td>
                <td>${escapeHtml(c.professional?.full_name || "—")}</td>
                <td><span class="pill bad">Pendente</span></td>
                <td class="right">${escapeHtml(formatCurrencyBRL(Number(c.amount)))}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>
  </div>
</body>
</html>`;

    const executablePath = await chromium.executablePath();

    // Ensure shared libraries shipped with @sparticuz/chromium are discoverable.
    // In serverless runtimes these are extracted under /tmp (commonly /tmp/lib and /tmp/lib64).
    const extractedBaseDir = path.dirname(executablePath); // e.g. /tmp
    const extractedChromiumDir = path.join(extractedBaseDir, "chromium");
    const libPaths = [
      path.join(extractedChromiumDir, "lib"),
      path.join(extractedChromiumDir, "lib64"),
      path.join(extractedBaseDir, "lib"),
      path.join(extractedBaseDir, "lib64"),
      "/tmp/lib",
      "/tmp/lib64",
      "/usr/lib64",
      "/usr/lib",
      "/lib64",
      "/lib",
    ];
    const currentLd = process.env.LD_LIBRARY_PATH;
    const nextLd = [...libPaths, currentLd].filter(Boolean).join(":");
    process.env.LD_LIBRARY_PATH = nextLd;

    const remoteWsEndpoint = getRemoteBrowserWSEndpoint();
    const browser = remoteWsEndpoint
      ? await puppeteer.connect({
          browserWSEndpoint: remoteWsEndpoint,
          protocolTimeout: 120_000,
        })
      : await puppeteer.launch({
          args: [...chromium.args, "--disable-dev-shm-usage", "--no-zygote"],
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
        });

    try {
      const page = await browser.newPage();

      page.setDefaultTimeout(120_000);
      page.setDefaultNavigationTimeout(120_000);

      // networkidle0 can hang indefinitely on remote Chrome providers.
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "24mm", right: "14mm", bottom: "18mm", left: "14mm" },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="
            width: 100%;
            padding: 0 14mm;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            font-size: 9px;
            color: #334155;
          ">
            <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
              <div style="font-weight: 800; letter-spacing: .2px;">BeautyGest</div>
              <div style="text-align:right;">
                <span style="font-weight: 700;">Relatório Financeiro</span>
                <span style="color:#64748b; margin-left: 8px;">${escapeHtml(formatDateBR(start))} a ${escapeHtml(
          formatDateBR(end)
        )}</span>
              </div>
            </div>
            <div style="height: 1px; background: #e5e7eb; margin-top: 6px;"></div>
          </div>
        `,
        footerTemplate: `
          <div style="
            width: 100%;
            padding: 0 14mm;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            font-size: 9px;
            color: #64748b;
          ">
            <div style="height: 1px; background: #e5e7eb; margin-bottom: 6px;"></div>
            <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
              <div>Gerado em ${escapeHtml(generatedAt)}</div>
              <div>Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
            </div>
          </div>
        `,
      });

      const filename = `relatorio-financeiro-${startDateOnly}-${endDateOnly}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(Buffer.from(pdfBuffer));
    } finally {
      // connect() uses disconnect(), launch() uses close()
      if (remoteWsEndpoint) browser.disconnect();
      else await browser.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: message, remoteBrowser: sanitizeWsEndpoint(getRemoteBrowserWSEndpoint()) } as Json);
  }
}
