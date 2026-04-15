import express from 'express';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { corsMiddleware } from './shared/cors';
import { authMiddleware } from './shared/auth';
import { dbMiddleware } from './shared/db';
import { errorHandler } from './shared/errorHandler';
import { setCorrelationId } from './shared/logging';
import { checkRateLimit } from './shared/rateLimit';
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

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'clinicnest-api' }));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ClinicNest API running on port ${PORT}`);
});

export default app;
