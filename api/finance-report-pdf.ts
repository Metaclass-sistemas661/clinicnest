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
  return numbers.reduce((acc, v) => acc + Number(v ?? 0), 0);
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
        p_year: end.getFullYear(),
        p_month: end.getMonth() + 1,
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

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório Financeiro</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    .header { display:flex; align-items:center; justify-content:space-between; background: #7c3aed; color: white; padding: 14px 16px; border-radius: 10px; }
    .brand { font-weight: 800; letter-spacing: .4px; font-size: 16px; }
    .meta { text-align:right; font-size: 11px; opacity: .95; }
    .meta strong { display:block; font-size: 12px; }
    .section { margin-top: 14px; }
    .h2 { font-size: 13px; font-weight: 800; margin: 0 0 8px 0; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; background: #ffffff; }
    .card .label { font-size: 10px; letter-spacing: .08em; color: #64748b; font-weight: 700; }
    .card .value { margin-top: 6px; font-size: 14px; font-weight: 800; }
    .pill { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .pill.ok { background: #dcfce7; color: #166534; }
    .pill.bad { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 8px 8px; color: #475569; border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px 8px; font-size: 11px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .right { text-align:right; }
    .muted { color:#64748b; }
    .small { font-size: 10px; }
    .footer { margin-top: 10px; font-size: 10px; color: #64748b; display:flex; justify-content: space-between; }
    .kpiRow { display:flex; gap:10px; flex-wrap:wrap; }
    .kpiRow .card { flex: 1; min-width: 150px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">VynloBella</div>
      <div class="small" style="opacity:.95">${escapeHtml(tenantLabel)}</div>
    </div>
    <div class="meta">
      <strong>Relatório Financeiro</strong>
      ${escapeHtml(formatDateBR(start))} a ${escapeHtml(formatDateBR(end))}
    </div>
  </div>

  <div class="section">
    <div class="h2">Resumo Executivo</div>
    <div class="grid">
      <div class="card">
        <div class="label">Saldo</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(balance))}</div>
        <div class="small muted">${balance >= 0 ? "Positivo" : "Negativo"}</div>
      </div>
      <div class="card">
        <div class="label">Receitas</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(incomeTotal))}</div>
        <div class="small muted">No período</div>
      </div>
      <div class="card">
        <div class="label">Despesas</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(expenseTotal))}</div>
        <div class="small muted">No período</div>
      </div>
      <div class="card">
        <div class="label">Perdas (danificados)</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(productLossTotal))}</div>
        <div class="small muted">No período</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="h2">Comissões</div>
    <div class="kpiRow">
      <div class="card">
        <div class="label">Pagas</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(commissionsPaidTotal))}</div>
      </div>
      <div class="card">
        <div class="label">Pendentes</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(commissionsPendingTotal))}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="h2">Salários (mês de referência: ${end.getMonth() + 1}/${end.getFullYear()})</div>
    <div class="kpiRow">
      <div class="card">
        <div class="label">Pagos</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(paidSalaryTotal))}</div>
      </div>
      <div class="card">
        <div class="label">Pendentes</div>
        <div class="value">${escapeHtml(formatCurrencyBRL(pendingSalaryTotal))}</div>
      </div>
    </div>

    <div style="margin-top:10px">
      <div class="h2" style="font-size:12px">Detalhamento</div>
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
          ${professionalsWithSalary
            .filter((p) => p.professional_id && !paidIds.has(p.professional_id) && Number(p.salary_amount || 0) > 0)
            .map((p) => {
              const statusPill = `<span class="pill bad">Pendente</span>`;
              return `<tr>
                <td>${escapeHtml(p.professional_name || "—")}</td>
                <td>${escapeHtml(String(end.getMonth() + 1))}/${escapeHtml(String(end.getFullYear()))}</td>
                <td>${statusPill}</td>
                <td class="right">${escapeHtml(formatCurrencyBRL(Number(p.salary_amount)))}</td>
                <td>—</td>
                <td>${escapeHtml(p.default_payment_method || "—")}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <div class="small muted" style="margin-top:6px">
        Observação: salários pendentes são calculados a partir dos profissionais com salário configurado que ainda não constam como pagos no mês de referência.
      </div>
    </div>
  </div>

  <div class="section">
    <div class="h2">Transações (período)</div>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Categoria</th>
          <th>Descrição</th>
          <th class="right">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${transactions
          .slice(0, 150)
          .map((t) => {
            const d = new Date(t.transaction_date);
            const typeLabel = t.type === "income" ? "Entrada" : "Saída";
            const signed = (t.type === "income" ? "+" : "-") + formatCurrencyBRL(Number(t.amount));
            return `<tr>
              <td>${escapeHtml(formatDateBR(d))}</td>
              <td>${escapeHtml(typeLabel)}</td>
              <td>${escapeHtml(t.category || "—")}</td>
              <td>${escapeHtml(t.description || "—")}</td>
              <td class="right">${escapeHtml(signed)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    <div class="small muted" style="margin-top:6px">Mostrando até 150 linhas para manter o PDF leve.</div>
  </div>

  <div class="footer">
    <div>Gerado em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date()))}</div>
    <div class="muted">Tenant: ${escapeHtml(tenantId)}</div>
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
        })
      : await puppeteer.launch({
          args: [...chromium.args, "--disable-dev-shm-usage", "--no-zygote"],
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
        });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
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
    res.status(500).json({ error: message } as Json);
  }
}
