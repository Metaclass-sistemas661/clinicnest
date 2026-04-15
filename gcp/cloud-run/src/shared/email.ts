/**
 * Email — Resend API wrapper + HTML templates
 * Replaces: _shared/clinicEmail.ts + _shared/emailTemplate.ts
 */

const BRAND = {
  name: 'ClinicNest',
  color: '#0d9488',
  gradient: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
};

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const from = process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text: text || '' }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${err}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export function verificationCodeEmailHtml(name: string, code: string): string {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;padding:40px">
<table width="600" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:${BRAND.gradient};padding:30px;text-align:center">
<h1 style="color:#fff;margin:0">${BRAND.name}</h1></td></tr>
<tr><td style="padding:30px">
<h2>Olá, ${name}!</h2>
<p>Seu código de verificação é:</p>
<div style="text-align:center;margin:20px 0;padding:20px;background:#f9fafb;border-radius:8px">
<span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#7c3aed">${code}</span>
</div>
<p style="color:#6b7280">Este código expira em 15 minutos.</p>
</td></tr></table></body></html>`;
}

export function verificationCodeEmailText(name: string, code: string): string {
  return `Olá, ${name}!\n\nSeu código de verificação ${BRAND.name}: ${code}\n\nExpira em 15 minutos.`;
}

export { BRAND };
