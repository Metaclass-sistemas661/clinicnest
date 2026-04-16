import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { corsMiddleware } from './shared/cors';
import { authMiddleware } from './shared/auth';
import { dbMiddleware, adminQuery, pool } from './shared/db';
import { errorHandler } from './shared/errorHandler';
import { setCorrelationId } from './shared/logging';
import { checkRateLimit } from './shared/rateLimit';
import { requestLogger } from './shared/requestLogger';
import crypto from 'crypto';

// --- Route imports (65 functions) ---
// AI
import { aiAgentChat } from './functions/ai-agent-chat';
import { aiBenchmarking } from './functions/ai-benchmarking';
import { aiCancelPrediction } from './functions/ai-cancel-prediction';
import { aiCidSuggest } from './functions/ai-cid-suggest';
import { aiClinicalProtocols } from './functions/ai-clinical-protocols';
import { aiCopilot } from './functions/ai-copilot';
import { aiDeteriorationAlert } from './functions/ai-deterioration-alert';
import { aiDrugInteractions } from './functions/ai-drug-interactions';
import { aiExplainPatient } from './functions/ai-explain-patient';
import { aiGenerateSoap } from './functions/ai-generate-soap';
import { aiGpsEvaluate } from './functions/ai-gps-evaluate';
import { aiOcrExam } from './functions/ai-ocr-exam';
import { aiPatientChat } from './functions/ai-patient-chat';
import { aiRevenueIntelligence } from './functions/ai-revenue-intelligence';
import { aiSentiment } from './functions/ai-sentiment';
import { aiSmartReferral } from './functions/ai-smart-referral';
import { aiSummary } from './functions/ai-summary';
import { aiTranscribe } from './functions/ai-transcribe';
import { aiTriage } from './functions/ai-triage';
import { aiWeeklySummary } from './functions/ai-weekly-summary';

// Auth & Team
import { activatePatientAccount } from './functions/activate-patient-account';
import { inviteTeamMember } from './functions/invite-team-member';
import { registerUser } from './functions/register-user';
import { removeTeamMember } from './functions/remove-team-member';
import { resetTeamMemberPassword } from './functions/reset-team-member-password';
import { updatePassword } from './functions/update-password';
import { verifyEmailCode } from './functions/verify-email-code';
import { jwtProbe } from './functions/jwt-probe';

// Payments
import { asaasPix } from './functions/asaas-pix';
import { cancelSubscription } from './functions/cancel-subscription';
import { checkSubscription } from './functions/check-subscription';
import { createChargeWithSplit } from './functions/create-charge-with-split';
import { createCheckout } from './functions/create-checkout';
import createPatientPayment from './functions/create-patient-payment';
import { paymentWebhookHandler } from './functions/payment-webhook-handler';

// Notifications
import { notifyPatientAppointment } from './functions/notify-patient-appointment';
import notifyPatientEvents from './functions/notify-patient-events';
import { notifyPatientInvoiceDue } from './functions/notify-patient-invoice-due';
import { notifyPatientMessage } from './functions/notify-patient-message';
import { runCampaign } from './functions/run-campaign';
import { smsSender } from './functions/sms-sender';

// WhatsApp
import { evolutionProxy } from './functions/evolution-proxy';
import { whatsappChatbot } from './functions/whatsapp-chatbot';
import { whatsappSalesChatbot } from './functions/whatsapp-sales-chatbot';
import { whatsappSender } from './functions/whatsapp-sender';
import { landingChat } from './functions/landing-chat';

// Clinical / Patient
import exportPatientFhir from './functions/export-patient-fhir';
import { generatePatientExtract } from './functions/generate-patient-extract';
import { publicBooking } from './functions/public-booking';
import { sealConsentPdf } from './functions/seal-consent-pdf';
import { waitlistAutoBook } from './functions/waitlist-auto-book';
import { validateCouncilNumber } from './functions/validate-council-number';

// Integrations
import { hl7Receiver } from './functions/hl7-receiver';
import { hl7Sender } from './functions/hl7-sender';
import { rndsReceiveBundle } from './functions/rnds-receive-bundle';
import { rndsSubmit } from './functions/rnds-submit';
import { emitNfse } from './functions/emit-nfse';
import { nfseWebhookHandler } from './functions/nfse-webhook-handler';

// Email & Support
import { sendCustomAuthEmail } from './functions/send-custom-auth-email';
import { sendSupportTicketEmail } from './functions/send-support-ticket-email';
import { sendWeeklyFinancialSummary } from './functions/send-weekly-financial-summary';
import { submitContactMessage } from './functions/submit-contact-message';

// Twilio
import { twilioToken } from './functions/twilio-token';
import { twilioVideoToken } from './functions/twilio-video-token';

// Workers
import { automationWorker } from './functions/automation-worker';

// REST/RPC/Storage proxy (replaces PostgREST)
import { restProxy, rpcProxy, storageProxy } from './routes/rest-proxy';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// ─── Sentry Init ────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data?.url) b.data.url = b.data.url.replace(/Bearer [^\s]+/, 'Bearer ***');
          return b;
        });
      }
      return event;
    },
  });
}

// Global middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(corsMiddleware);

// Request correlation ID + duration logging
app.use((req, _res, next) => {
  const traceHeader = req.headers['x-cloud-trace-context'];
  const correlationId = typeof traceHeader === 'string'
    ? traceHeader.split('/')[0]
    : crypto.randomUUID();
  (req as any).correlationId = correlationId;
  setCorrelationId(correlationId);
  next();
});

// Structured request logging (method, status, duration, userId)
app.use(requestLogger);

// Request timeout — 55s (Cloud Run default is 60s)
app.use((req, res, next) => {
  const timeout = req.path.startsWith('/api/ai-') ? 120_000 : 55_000;
  req.setTimeout(timeout);
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'A requisição excedeu o tempo limite. Tente novamente.' });
    }
  });
  next();
});

// Global rate limit — 200 req/min per IP (excludes health checks)
app.use(async (req, res, next) => {
  if (req.path === '/health') return next();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'unknown';
  const result = await checkRateLimit(`global:${ip}`, 200, 60);
  if (!result.allowed) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
  }
  next();
});

// Health check (no auth) — readiness probe with DB ping
app.get('/health', async (_req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down', service: 'clinicnest-api' });
  }

  const checks: Record<string, string> = {};
  let healthy = true;

  // DB connectivity
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    checks.db = `ok (${Date.now() - t0}ms)`;
  } catch {
    checks.db = 'unreachable';
    healthy = false;
  }

  // Pool stats
  const poolStats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'clinicnest-api',
    checks,
    pool: poolStats,
    uptime: Math.floor(process.uptime()),
  });
});

// Public endpoints (no auth required)
app.post('/api/submit-contact-message', submitContactMessage);
app.post('/api/public-booking', publicBooking);
app.post('/api/landing-chat', landingChat);
app.post('/api/send-custom-auth-email', sendCustomAuthEmail);
app.post('/api/register-user', registerUser);
app.post('/api/verify-email-code', verifyEmailCode);
app.post('/api/activate-patient-account', activatePatientAccount);
app.post('/api/jwt-probe', jwtProbe);

// Webhook endpoints (verified by token, not JWT)
app.post('/api/webhooks/payment', paymentWebhookHandler);
app.post('/api/webhooks/asaas-pix', asaasPix);
app.post('/api/webhooks/nfse', nfseWebhookHandler);
app.post('/api/webhooks/hl7-receiver', hl7Receiver);
app.post('/api/webhooks/rnds-receive-bundle', rndsReceiveBundle);
app.post('/api/webhooks/whatsapp-chatbot', whatsappChatbot);
app.post('/api/webhooks/whatsapp-sales-chatbot', whatsappSalesChatbot);

// Internal/Cron endpoints (verified by CRON_SECRET or AUTOMATION_WORKER_KEY)
app.post('/api/internal/automation-worker', automationWorker);
app.post('/api/internal/send-weekly-financial-summary', sendWeeklyFinancialSummary);
app.post('/api/internal/ai-weekly-summary', aiWeeklySummary);
app.post('/api/internal/run-campaign', runCampaign);
app.post('/api/internal/notify-patient-invoice-due', notifyPatientInvoiceDue);
app.post('/api/internal/waitlist-auto-book', waitlistAutoBook);

// Authenticated endpoints (JWT required)
app.use('/api', authMiddleware);
app.use('/api', dbMiddleware);

// AI endpoints
app.post('/api/ai-agent-chat', aiAgentChat);
app.post('/api/ai-benchmarking', aiBenchmarking);
app.post('/api/ai-cancel-prediction', aiCancelPrediction);
app.post('/api/ai-cid-suggest', aiCidSuggest);
app.post('/api/ai-clinical-protocols', aiClinicalProtocols);
app.post('/api/ai-copilot', aiCopilot);
app.post('/api/ai-deterioration-alert', aiDeteriorationAlert);
app.post('/api/ai-drug-interactions', aiDrugInteractions);
app.post('/api/ai-explain-patient', aiExplainPatient);
app.post('/api/ai-generate-soap', aiGenerateSoap);
app.post('/api/ai-gps-evaluate', aiGpsEvaluate);
app.post('/api/ai-ocr-exam', aiOcrExam);
app.post('/api/ai-patient-chat', aiPatientChat);
app.post('/api/ai-revenue-intelligence', aiRevenueIntelligence);
app.post('/api/ai-sentiment', aiSentiment);
app.post('/api/ai-smart-referral', aiSmartReferral);
app.post('/api/ai-summary', aiSummary);
app.post('/api/ai-transcribe', aiTranscribe);
app.post('/api/ai-triage', aiTriage);

// Auth & Team
app.post('/api/invite-team-member', inviteTeamMember);
app.post('/api/remove-team-member', removeTeamMember);
app.post('/api/reset-team-member-password', resetTeamMemberPassword);
app.post('/api/update-password', updatePassword);

// Payments
app.post('/api/cancel-subscription', cancelSubscription);
app.post('/api/check-subscription', checkSubscription);
app.post('/api/create-charge-with-split', createChargeWithSplit);
app.post('/api/create-checkout', createCheckout);
app.post('/api/create-patient-payment', createPatientPayment);

// Notifications
app.post('/api/notify-patient-appointment', notifyPatientAppointment);
app.post('/api/notify-patient-events', notifyPatientEvents);
app.post('/api/notify-patient-message', notifyPatientMessage);
app.post('/api/sms-sender', smsSender);

// WhatsApp
app.post('/api/evolution-proxy', evolutionProxy);
app.post('/api/whatsapp-sender', whatsappSender);

// Clinical / Patient
app.post('/api/export-patient-fhir', exportPatientFhir);
app.post('/api/generate-patient-extract', generatePatientExtract);
app.post('/api/seal-consent-pdf', sealConsentPdf);
app.post('/api/validate-council-number', validateCouncilNumber);

// Integrations
app.post('/api/hl7-sender', hl7Sender);
app.post('/api/rnds-submit', rndsSubmit);
app.post('/api/emit-nfse', emitNfse);

// Email
app.post('/api/send-support-ticket-email', sendSupportTicketEmail);

// Twilio
app.post('/api/twilio-token', twilioToken);
app.post('/api/twilio-video-token', twilioVideoToken);

// Generic REST proxy (replaces PostgREST)
app.post('/api/rest', restProxy);
app.post('/api/rpc/:name', rpcProxy);
app.post('/api/storage/:bucket', storageProxy);

// Error handler
app.use(errorHandler);

// ─── Database bootstrap (idempotent) ─────────────────────────────────
async function bootstrap() {
  try {
    // Ensure email_verification_codes table exists
    await adminQuery(`
      CREATE TABLE IF NOT EXISTS public.email_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Ensure get_my_context function exists (no-arg version using session variable)
    await adminQuery(`DROP FUNCTION IF EXISTS public.get_my_context() CASCADE`);
    await adminQuery(`
      CREATE OR REPLACE FUNCTION public.get_my_context()
      RETURNS json
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT json_build_object(
          'profile', (SELECT row_to_json(p.*) FROM profiles p WHERE p.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid),
          'role', (SELECT row_to_json(ur.*) FROM user_roles ur WHERE ur.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid LIMIT 1),
          'tenant', (SELECT row_to_json(t.*) FROM tenants t WHERE t.id = (SELECT tenant_id FROM profiles WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)),
          'permissions', json_build_object()
        );
      $$
    `);

    // Fix schema gaps that break tenant-creation triggers
    // payment_methods needs code + sort_order columns and UNIQUE for seed trigger
    await adminQuery(`ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS code TEXT`);
    await adminQuery(`ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
    await adminQuery(`ALTER TABLE payment_methods ALTER COLUMN type SET DEFAULT 'other'`);
    await adminQuery(`
      DO $$ BEGIN
        ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_tenant_id_code_key UNIQUE(tenant_id, code);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$
    `);

    // lgpd_retention_policies.data_category needs a DEFAULT for the seed trigger
    await adminQuery(`ALTER TABLE lgpd_retention_policies ALTER COLUMN data_category SET DEFAULT 'geral'`);
    await adminQuery(`
      DO $$ BEGIN
        ALTER TABLE lgpd_retention_policies ADD CONSTRAINT lgpd_retention_policies_tenant_id_key UNIQUE(tenant_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$
    `);

    // Fix guard_user_roles_admin_promotion: use missing_ok + recognise clinicnest_admin
    await adminQuery(`
      CREATE OR REPLACE FUNCTION public.guard_user_roles_admin_promotion()
      RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
      DECLARE
        v_caller_role TEXT;
        v_session_user TEXT;
        v_current_uid TEXT;
      BEGIN
        IF NEW.role != 'admin' THEN RETURN NEW; END IF;
        v_caller_role := current_setting('role', true);
        IF v_caller_role IN ('postgres','supabase_admin','service_role','supabase_auth_admin','authenticator') THEN RETURN NEW; END IF;
        v_session_user := session_user;
        IF v_session_user IN ('supabase_auth_admin','postgres','supabase_admin','clinicnest_admin') THEN RETURN NEW; END IF;
        v_current_uid := current_setting('app.current_user_id', true);
        IF v_current_uid IS NOT NULL AND v_current_uid != '' THEN
          IF public.is_tenant_admin(v_current_uid::uuid, NEW.tenant_id) THEN RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'Apenas administradores podem definir role=admin' USING ERRCODE = 'insufficient_privilege';
      END;
      $fn$
    `);

    // ── stock_movements: ensure out_reason_type column exists ──
    await adminQuery(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS out_reason_type TEXT`);

    // ── patients: ensure all expected columns exist ──
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status TEXT`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS street TEXT`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS street_number TEXT`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS complement TEXT`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood TEXT`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_plan_id UUID`);
    await adminQuery(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_card_number TEXT`);

    // ── triage_records: ensure updated_at column exists ──
    await adminQuery(`ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`);

    // ── upsert_client_v2: corrigir p_client_id → p_patient_id, clients → patients ──
    await adminQuery(`DROP FUNCTION IF EXISTS public.upsert_client_v2 CASCADE`);
    await adminQuery(`
      CREATE OR REPLACE FUNCTION public.upsert_client_v2(
        p_name text, p_phone text DEFAULT NULL, p_email text DEFAULT NULL, p_notes text DEFAULT NULL,
        p_patient_id uuid DEFAULT NULL, p_cpf text DEFAULT NULL, p_date_of_birth date DEFAULT NULL,
        p_marital_status text DEFAULT NULL, p_zip_code text DEFAULT NULL, p_street text DEFAULT NULL,
        p_street_number text DEFAULT NULL, p_complement text DEFAULT NULL, p_neighborhood text DEFAULT NULL,
        p_city text DEFAULT NULL, p_state text DEFAULT NULL, p_allergies text DEFAULT NULL
      ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
      DECLARE
        v_user_id uuid := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
        v_profile public.profiles%rowtype;
        v_id uuid; v_access_code text; v_action text;
      BEGIN
        IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'P0001'; END IF;
        SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'Perfil do usuário não encontrado.' USING ERRCODE = 'P0001'; END IF;
        IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'O nome do paciente é obrigatório.' USING ERRCODE = 'P0001'; END IF;
        IF p_patient_id IS NULL THEN
          v_action := 'patient_created';
          INSERT INTO public.patients(tenant_id,name,phone,email,notes,cpf,date_of_birth,marital_status,zip_code,street,street_number,complement,neighborhood,city,state,allergies)
          VALUES(v_profile.tenant_id,p_name,NULLIF(p_phone,''),NULLIF(p_email,''),NULLIF(p_notes,''),NULLIF(btrim(p_cpf),''),p_date_of_birth,NULLIF(btrim(p_marital_status),''),NULLIF(btrim(p_zip_code),''),NULLIF(btrim(p_street),''),NULLIF(btrim(p_street_number),''),NULLIF(btrim(p_complement),''),NULLIF(btrim(p_neighborhood),''),NULLIF(btrim(p_city),''),NULLIF(btrim(p_state),''),NULLIF(btrim(p_allergies),''))
          RETURNING id, access_code INTO v_id, v_access_code;
        ELSE
          v_action := 'patient_updated';
          UPDATE public.patients SET name=p_name,phone=NULLIF(p_phone,''),email=NULLIF(p_email,''),notes=NULLIF(p_notes,''),cpf=NULLIF(btrim(p_cpf),''),date_of_birth=p_date_of_birth,marital_status=NULLIF(btrim(p_marital_status),''),zip_code=NULLIF(btrim(p_zip_code),''),street=NULLIF(btrim(p_street),''),street_number=NULLIF(btrim(p_street_number),''),complement=NULLIF(btrim(p_complement),''),neighborhood=NULLIF(btrim(p_neighborhood),''),city=NULLIF(btrim(p_city),''),state=NULLIF(btrim(p_state),''),allergies=NULLIF(btrim(p_allergies),''),updated_at=now()
          WHERE id=p_patient_id AND tenant_id=v_profile.tenant_id
          RETURNING id, access_code INTO v_id, v_access_code;
          IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado ou sem permissão.' USING ERRCODE = 'P0001'; END IF;
        END IF;
        RETURN jsonb_build_object('success',true,'patient_id',v_id,'access_code',v_access_code);
      END; $fn$
    `);

    console.log('[bootstrap] Database bootstrap completed');
  } catch (err: any) {
    console.error('[bootstrap] Database bootstrap failed:', err.message);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────────
let isShuttingDown = false;

bootstrap().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClinicNest API running on port ${PORT}`);
  });

  // Cloud Run sends SIGTERM before stopping
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[shutdown] ${signal} received — draining connections…`);

    // Stop accepting new connections
    server.close(async () => {
      console.log('[shutdown] HTTP server closed');
      try {
        const { pool } = await import('./shared/db');
        await pool.end();
        console.log('[shutdown] DB pool drained');
      } catch (e: any) {
        console.error('[shutdown] DB pool drain error:', e.message);
      }
      process.exit(0);
    });

    // Force kill after 25s (Cloud Run gives 30s)
    setTimeout(() => {
      console.error('[shutdown] Forced exit after timeout');
      process.exit(1);
    }, 25_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});

// Expose shutdown state for health check
export { isShuttingDown };
export default app;
