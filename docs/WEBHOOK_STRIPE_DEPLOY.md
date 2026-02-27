# Guia: Deploy do Webhook Stripe

Documento consolidado para configuração de webhooks Stripe e Edge Functions relacionadas.

## Pré-requisitos

- Conta no Supabase (projeto clinicnest)
- Conta no Stripe
- Supabase CLI: https://supabase.com/docs/guides/cli

---

## Passo 1: Instalar Supabase CLI

Windows (PowerShell):
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Ou: https://github.com/supabase/cli/releases

---

## Passo 2: Login e linkar projeto

```bash
supabase login
cd ClinicNest
supabase link --project-ref pijjuhtyxcidqceukogv
```

---

## Passo 3: Secrets obrigatórias

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
supabase secrets set SITE_URL=https://seusite.vercel.app
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # (após criar endpoint no Stripe)
```

Opcional:
```bash
supabase secrets set RESEND_API_KEY=re_...
```

### CORS em produção (Seção 4.4)

Para restringir origens em produção, defina:

```bash
supabase secrets set SUPABASE_CORS_ORIGINS=https://clinicnest.metaclass.com.br,https://www.clinicnest.metaclass.com.br
```

As Edge Functions que usam `getCorsHeaders(req)` respeitam essa variável. Sem ela, usa `*` (desenvolvimento).

---

## Passo 4: Deploy da Edge Function

```bash
supabase functions deploy stripe-webhook
```

Anote a URL retornada.

---

## Passo 5: Configurar webhook no Stripe

1. https://dashboard.stripe.com/webhooks → Add endpoint
2. URL: `https://pijjuhtyxcidqceukogv.supabase.co/functions/v1/stripe-webhook`
3. Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copie o Signing secret (`whsec_...`)
5. `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
6. Re-deploy: `supabase functions deploy stripe-webhook`

---

## Passo 6: Testar

Pagamento de teste: cartão `4242 4242 4242 4242`.

Logs:
```bash
supabase functions logs stripe-webhook --follow
```

---

## Checklist

- [ ] Supabase CLI instalado e logado
- [ ] Projeto linkado
- [ ] Secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SITE_URL, STRIPE_WEBHOOK_SECRET
- [ ] SUPABASE_CORS_ORIGINS em produção (opcional mas recomendado)
- [ ] Função deployada
- [ ] Endpoint criado no Stripe
- [ ] Testado com pagamento de teste

---

## Troubleshooting

- **400/500:** Confira logs e secrets
- **E-mail não enviado:** Configurar RESEND_API_KEY e domínio no Resend
- **Usuário não criado:** Verificar migrations e SUPABASE_SERVICE_ROLE_KEY
