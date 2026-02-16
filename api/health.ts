import type { VercelRequest, VercelResponse } from "@vercel/node";

function hasEnv(name: string): boolean {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const required = ["SUPABASE_URL"];
  const missing = required.filter((k) => !hasEnv(k));

  if (missing.length > 0) {
    res.status(503).json({ ok: false, status: "degraded", missing });
    return;
  }

  res.status(200).json({
    ok: true,
    status: "ok",
    ts: new Date().toISOString(),
  });
}
