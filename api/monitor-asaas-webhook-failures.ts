import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";
import { isCronAuthorized } from "./_shared/cronAuth";
import { sendEmailViaResend } from "./_shared/emailAlerts";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isCronAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: process.env.VERCEL_ENV, release: process.env.VERCEL_GIT_COMMIT_SHA });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const windowMinutes = Number(process.env.WEBHOOK_ALERT_WINDOW_MINUTES ?? "30");
    const lookbackIso = new Date(Date.now() - windowMinutes * 60_000).toISOString();

    const { data: failed, error } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("event_key,event_type,received_at,last_error,attempts,alert_sent_at,alert_attempts")
      .eq("status", "failed")
      .is("alert_sent_at", null)
      .gte("received_at", lookbackIso)
      .order("received_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const events = (failed ?? []) as Array<any>;
    if (events.length === 0) {
      res.status(200).json({ ok: true, alerted: 0 });
      return;
    }

    const alertTo = getEnv("ALERT_EMAIL_TO");
    const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL || "";

    let alerted = 0;
    for (const e of events) {
      const eventKey = String(e.event_key);
      const type = String(e.event_type ?? "unknown");
      const receivedAt = String(e.received_at ?? "");
      const lastError = e.last_error ? String(e.last_error) : "(no last_error)";

      const title = `Asaas webhook failed: ${type}`;
      const text = `Asaas webhook event failed\n\nevent_key: ${eventKey}\ntype: ${type}\nreceived_at: ${receivedAt}\n\nlast_error: ${lastError}\n\napp: ${baseUrl}`;
      const html = `<pre style="white-space:pre-wrap">${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>`;

      try {
        await sendEmailViaResend({ to: alertTo, subject: title, html, text });

        if (sentryDsn) {
          Sentry.captureMessage(title, {
            level: "error",
            extra: { event_key: eventKey, type, received_at: receivedAt, attempts: e.attempts ?? null, last_error: lastError },
          });
          await Sentry.flush(2000);
        }

        const { error: updateError } = await supabaseAdmin
          .from("asaas_webhook_events")
          .update({
            alert_sent_at: new Date().toISOString(),
            alert_attempts: Number(e.alert_attempts ?? 0) + 1,
            alert_last_error: null,
          })
          .eq("event_key", eventKey);

        if (updateError) throw updateError;

        alerted += 1;
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        if (sentryDsn) {
          Sentry.captureException(sendErr);
          await Sentry.flush(2000);
        }

        await supabaseAdmin
          .from("asaas_webhook_events")
          .update({
            alert_attempts: Number(e.alert_attempts ?? 0) + 1,
            alert_last_error: msg,
          })
          .eq("event_key", eventKey);
      }
    }

    res.status(200).json({ ok: true, found: events.length, alerted });
  } catch (err) {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
      await Sentry.flush(2000);
    }

    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
