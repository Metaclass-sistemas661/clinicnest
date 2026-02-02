# Configuração do Webhook Stripe → Criação Automática de Login

Este documento explica como configurar o webhook do Stripe para criar automaticamente a conta (login) do cliente quando ele paga uma assinatura.

---

## 1. Variáveis de Ambiente Necessárias

### No Supabase (Edge Functions)

Adicione estas variáveis no Supabase:

| Variável | Onde encontrar | Exemplo |
|----------|----------------|---------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → **Secret key** (`sk_live_...` ou `sk_test_...`) | `sk_test_51ABC...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → (após criar endpoint) **Signing secret** (`whsec_...`) | `whsec_abc123...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → **service_role key** (secret) | `eyJhbGc...` (JWT longo) |
| `SITE_URL` | URL do seu site em produção (para redirect do magic link) | `https://vynlobella.com` ou `https://seusite.vercel.app` |

**Como adicionar no Supabase:**

Opção A – Via Dashboard:
- Supabase → Project Settings → Edge Functions → Add secret

Opção B – Via CLI (na pasta do projeto):
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SITE_URL=https://seusite.com
```

---

## 2. Deploy da Edge Function

Na pasta do projeto:

```bash
cd c:\Users\andre\Desktop\Vynlobella\salon-flow
supabase functions deploy stripe-webhook
```

Após o deploy, anote a URL da função:

```
https://pijjuhtyxcidqceukogv.supabase.co/functions/v1/stripe-webhook
```

---

## 3. Configurar Webhook no Stripe

1. Acesse: [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **Add endpoint**
3. Preencha:
   - **Endpoint URL:** `https://[seu-projeto].supabase.co/functions/v1/stripe-webhook`
   - **Description:** `VynloBella - Criação de login após pagamento`
   - **Events to send:** Selecione:
     - ✅ `checkout.session.completed` (pagamento confirmado)
     - ✅ `customer.subscription.updated` (renovação, mudança de plano)
     - ✅ `customer.subscription.deleted` (cancelamento)
4. Clique em **Add endpoint**
5. **Copie o Signing secret** (`whsec_...`) que aparece na tela
6. Adicione ao Supabase como `STRIPE_WEBHOOK_SECRET` (passo 1 acima)

---

## 4. Testar o Webhook Localmente (opcional)

Para testar antes de colocar em produção:

1. Instale o Stripe CLI: https://stripe.com/docs/stripe-cli
2. Faça login:
   ```bash
   stripe login
   ```
3. Encaminhe eventos para a função local:
   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   ```
4. Em outro terminal, rode a função localmente:
   ```bash
   supabase functions serve stripe-webhook
   ```
5. Crie um checkout de teste no Stripe e veja os logs

---

## 5. Fluxo Implementado

### O que acontece quando um cliente paga:

1. **Cliente paga** no Stripe Checkout (link de pagamento ou botão na landing).
2. **Stripe dispara** `checkout.session.completed` para a URL do webhook.
3. **Edge Function recebe** o evento e:
   - Valida a assinatura do Stripe (segurança).
   - Extrai e-mail e nome do cliente.
   - **Verifica se o usuário já existe:**
     - Se **não existir**: cria usuário no Supabase Auth, tenant (salão), profile, user_role (admin), subscription (ativa).
     - Se **já existir**: apenas atualiza a subscription (ativa).
   - **Gera magic link** para o cliente acessar o sistema sem senha.
   - **(TODO)** Envia e-mail com o magic link.
4. **Cliente recebe e-mail** e clica no link → entra direto no dashboard.

### Outros eventos:

- **`customer.subscription.updated`**: atualiza status e período da assinatura no banco.
- **`customer.subscription.deleted`**: marca assinatura como inativa.

---

## 6. Envio de E-mail (próximo passo)

Atualmente o webhook **gera o magic link** mas não envia o e-mail (há um `TODO` no código).

Para enviar e-mail, escolha um serviço:

### Opção A – Resend (recomendado, simples)

1. Crie conta em [resend.com](https://resend.com)
2. Gere API key
3. Adicione no Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   ```
4. Descomente o código no final de `sendWelcomeEmail()` (linha ~340) para enviar via Resend.

### Opção B – SendGrid, Mailgun, etc.

Similar: API key + fetch para o endpoint do serviço.

### Opção C – SMTP do Supabase (Auth)

Configure SMTP no Supabase (Settings → Auth → SMTP). O Supabase envia e-mails automaticamente para magic links.

---

## 7. Monitoramento

- **Logs da Edge Function:** Supabase Dashboard → Edge Functions → stripe-webhook → Logs
- **Eventos no Stripe:** Stripe Dashboard → Developers → Webhooks → [seu endpoint] → Events

Se um evento falhar (ex.: erro no código), o Stripe tenta reenviar automaticamente.

---

## 8. Checklist Final

- [ ] Variáveis de ambiente configuradas no Supabase (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SITE_URL)
- [ ] Edge Function `stripe-webhook` deployada (`supabase functions deploy stripe-webhook`)
- [ ] Endpoint criado no Stripe Dashboard com URL da função
- [ ] Eventos selecionados: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Signing secret do Stripe copiado e adicionado como `STRIPE_WEBHOOK_SECRET`
- [ ] (Opcional) Serviço de e-mail integrado (Resend, SendGrid, etc.)
- [ ] Testado com pagamento de teste no Stripe

---

## Suporte

Se tiver dúvidas ou erros:
1. Veja os logs da Edge Function no Supabase
2. Veja os eventos no Stripe Dashboard → Webhooks
3. Confirme que todas as env vars estão corretas
