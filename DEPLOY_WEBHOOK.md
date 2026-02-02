# Guia Rápido: Deploy do Webhook Stripe

## Pré-requisitos

- Conta no Supabase (com o projeto salon-flow)
- Conta no Stripe
- Supabase CLI instalado: https://supabase.com/docs/guides/cli

---

## Passo 1: Instalar Supabase CLI (se ainda não tiver)

Windows (PowerShell):
```powershell
# Via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Ou baixe o instalador: https://github.com/supabase/cli/releases

---

## Passo 2: Login no Supabase

```bash
supabase login
```

Vai abrir o navegador para autenticar.

---

## Passo 3: Linkar o Projeto Local com o Supabase

Na pasta do projeto:

```bash
cd c:\Users\andre\Desktop\Vynlobella\salon-flow
supabase link --project-ref pijjuhtyxcidqceukogv
```

(Troque `pijjuhtyxcidqceukogv` pelo ID do seu projeto, se for diferente)

---

## Passo 4: Configurar Variáveis de Ambiente (Secrets)

```bash
# Stripe Secret Key (pegar no Stripe Dashboard → API keys)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Service Role Key (pegar no Supabase Dashboard → Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# URL do site (URL de produção, ex: Vercel)
supabase secrets set SITE_URL=https://seusite.vercel.app

# (Opcional) Resend API Key para envio de e-mail
supabase secrets set RESEND_API_KEY=re_...
```

**Importante:** O `STRIPE_WEBHOOK_SECRET` você só vai ter **depois** de criar o endpoint no Stripe (passo 6).

---

## Passo 5: Deploy da Edge Function

```bash
supabase functions deploy stripe-webhook
```

Vai aparecer algo como:

```
Deployed Function stripe-webhook on project pijjuhtyxcidqceukogv
URL: https://pijjuhtyxcidqceukogv.supabase.co/functions/v1/stripe-webhook
```

**Anote essa URL** (você vai usar no próximo passo).

---

## Passo 6: Configurar Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **Add endpoint**
3. Cole a URL da função: `https://pijjuhtyxcidqceukogv.supabase.co/functions/v1/stripe-webhook`
4. Selecione os eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Clique **Add endpoint**
6. **Copie o Signing secret** (`whsec_...`)
7. Adicione no Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

8. **Re-deploy** a função para pegar o novo secret:

```bash
supabase functions deploy stripe-webhook
```

---

## Passo 7: Testar

### Opção A – Criar pagamento de teste no Stripe

1. No Stripe Dashboard, vá em **Products** → crie um produto
2. Ou use os price IDs que já estão no código:
   - `price_1SwMlSQ6oE5cHTfzFOnfAuVi` (Mensal)
   - `price_1SwMluQ6oE5cHTfzOY5oVLFN` (Trimestral)
   - `price_1SwMmXQ6oE5cHTfzrZy5P01K` (Anual)
3. Crie um Payment Link no Stripe com um desses prices
4. Abra o link, pague com cartão de teste: `4242 4242 4242 4242`, qualquer data futura, qualquer CVC
5. Veja os logs da função:

```bash
supabase functions logs stripe-webhook
```

Ou no Dashboard: Supabase → Edge Functions → stripe-webhook → Logs

### Opção B – Testar localmente com Stripe CLI

```bash
stripe listen --forward-to https://pijjuhtyxcidqceukogv.supabase.co/functions/v1/stripe-webhook
```

Ou:

```bash
# Rodar função local
supabase functions serve stripe-webhook

# Em outro terminal
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

---

## Passo 8: Verificar no Banco

Depois de um pagamento de teste, confira no Supabase (SQL Editor ou Table Editor):

```sql
SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;
SELECT * FROM tenants ORDER BY created_at DESC LIMIT 1;
SELECT * FROM profiles ORDER BY created_at DESC LIMIT 1;
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;
```

Se tudo estiver ok:
- Novo usuário criado
- Tenant criado
- Profile criado
- Subscription ativa

---

## Checklist

- [ ] Supabase CLI instalado e logado
- [ ] Projeto linkado (`supabase link`)
- [ ] Secrets configuradas (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SITE_URL, STRIPE_WEBHOOK_SECRET)
- [ ] Função deployada (`supabase functions deploy stripe-webhook`)
- [ ] Endpoint criado no Stripe Dashboard
- [ ] Eventos selecionados (checkout.session.completed, etc.)
- [ ] Signing secret copiado e adicionado
- [ ] Re-deploy após adicionar STRIPE_WEBHOOK_SECRET
- [ ] Testado com pagamento de teste
- [ ] (Opcional) RESEND_API_KEY configurado para enviar e-mails

---

## Comandos úteis

```bash
# Ver logs da função
supabase functions logs stripe-webhook --follow

# Re-deploy após mudanças
supabase functions deploy stripe-webhook

# Ver secrets (não mostra valores, só nomes)
supabase secrets list

# Deletar função (se precisar)
supabase functions delete stripe-webhook
```

---

## Próximos passos

1. **(Opcional) Configurar Resend** para envio de e-mails:
   - Criar conta em https://resend.com
   - Adicionar e verificar domínio
   - Gerar API key
   - `supabase secrets set RESEND_API_KEY=re_...`
   - Re-deploy da função

2. **Criar Checkout público** (sem login) na landing page:
   - Opção A: Payment Link do Stripe (mais fácil)
   - Opção B: Nova Edge Function `create-public-checkout`

3. **Integrar landing page** com o Checkout do Stripe

---

## Troubleshooting

### Webhook retorna 400 ou 500

- Veja os logs: `supabase functions logs stripe-webhook`
- Confirme que todas as secrets estão configuradas
- Confirme que STRIPE_WEBHOOK_SECRET é do endpoint certo (cada endpoint tem seu próprio secret)

### E-mail não é enviado

- Se não configurou Resend, o e-mail não será enviado (só o magic link aparece nos logs)
- Se configurou Resend, veja os logs para ver se há erro
- Confirme que o domínio está verificado no Resend

### Usuário não é criado

- Veja os logs para ver onde falhou
- Confirme que SUPABASE_SERVICE_ROLE_KEY está correta
- Confirme que as migrations foram aplicadas (tabelas tenants, profiles, user_roles, subscriptions existem)
