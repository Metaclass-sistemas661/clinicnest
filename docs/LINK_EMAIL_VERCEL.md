# Link do email indo para salon-flow-ten.vercel.app

Se o link do email de boas-vindas ainda abre `salon-flow-ten.vercel.app` em vez de `vynlobella.com`, verifique estes pontos.

---

## 1. Código (já corrigido)

O link no email enviado pela função **invite-team-member** está **fixo** em `https://vynlobella.com/login` (não usa mais variável de ambiente). Depois de alterar, faça o deploy:

```bash
supabase functions deploy invite-team-member
```

---

## 2. Resend – Click tracking

O **Resend** pode reescrever os links do email para rastrear cliques. O destino final costuma ser o mesmo que você colocou no HTML, mas vale conferir:

1. Acesse [Resend Dashboard](https://resend.com/domains) → **Domains**
2. Clique no domínio usado (ex.: `vynlobella.com`)
3. Veja se **Click tracking** está ativado
4. Se estiver e o link ainda abrir vercel.app, **desative** temporariamente o click tracking e teste de novo

Ao desativar, o link no email passa a ser exatamente `https://vynlobella.com/login`, sem passar pelo redirect do Resend.

---

## 3. Qual email está sendo clicado?

- **Email do Resend** (assunto: "Bem-vindo à equipe do VynloBella! 🎉")  
  → Esse é o que controlamos na Edge Function. O link desse email deve ser `https://vynlobella.com/login` após o deploy acima.

- **Email do Supabase Auth** (confirmação de conta)  
  → Com `email_confirm: true` na criação do usuário, o Supabase **não** envia email de confirmação. Se mesmo assim aparecer algum email do Supabase, o link dele usa a **Site URL** do projeto (veja item 4).

---

## 4. Supabase – Site URL (Auth)

Se existir algum email de confirmação enviado pelo Supabase, o link dele usa a **Site URL** do projeto:

1. [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto
2. **Authentication** → **URL Configuration**
3. Em **Site URL**, coloque: `https://vynlobella.com`
4. Em **Redirect URLs**, inclua:
   - `https://vynlobella.com/**`
   - `https://vynlobella.com/login`
   - `https://vynlobella.com/dashboard`
5. Salve

Assim, qualquer link gerado pelo Auth (magic link, confirmação, etc.) usará `vynlobella.com`.

---

## 5. Vercel – Domínio vynlobella.com

Se o link no email for `https://vynlobella.com/login` mas o navegador **redirecionar** para `salon-flow-ten.vercel.app`, o problema é no Vercel/DNS:

1. [Vercel Dashboard](https://vercel.com/dashboard) → projeto do salon-flow
2. **Settings** → **Domains**
3. Confirme que `vynlobella.com` está na lista (e, se quiser, como domínio principal)
4. Veja se há algum **Redirect** ou regra que mande `vynlobella.com` para `salon-flow-ten.vercel.app` e remova ou ajuste
5. No seu provedor de DNS (onde o domínio está registrado), confirme que o registro para `vynlobella.com` aponta para o Vercel (CNAME ou A conforme a documentação do Vercel)

Se `vynlobella.com` não estiver configurado no Vercel ou no DNS, ao abrir `vynlobella.com` pode cair em outra página ou o Vercel pode mostrar o app só em `salon-flow-ten.vercel.app`.

---

## 6. Teste rápido

1. Envie um **novo** convite (novo membro ou outro email).
2. No email recebido, **passe o mouse** sobre o botão "Acessar o Sistema" (ou o link de login) **sem clicar** e olhe o canto inferior do navegador ou a dica que mostra a URL.
   - Se aparecer `https://resend.com/...` ou algo parecido → é click tracking do Resend; o destino final pode estar errado (veja item 2).
   - Se aparecer `https://vynlobella.com/login` → o nosso código está certo; se ao clicar cair em vercel.app, o problema é redirect no Vercel/DNS (item 5).
   - Se aparecer `https://salon-flow-ten.vercel.app/...` → o email é antigo ou ainda está sendo gerado com a URL errada; confirme o deploy da função e a Site URL do Supabase (itens 1 e 4).

---

## Resumo

| Onde verificar | O que fazer |
|----------------|-------------|
| **Código** | Link fixo `https://vynlobella.com/login` + `supabase functions deploy invite-team-member` |
| **Resend** | Desativar click tracking no domínio (se o link ainda for wrong) |
| **Supabase Auth** | Site URL = `https://vynlobella.com`, Redirect URLs com `vynlobella.com` |
| **Vercel/DNS** | Domínio `vynlobella.com` configurado no projeto e no DNS, sem redirect indesejado para vercel.app |

Depois de cada alteração, teste com um **novo** convite e conferindo a URL ao passar o mouse no link antes de clicar.
