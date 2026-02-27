# Link do email indo para URL errada

Se o link do email de boas-vindas ainda abre a URL errada em vez do domínio de produção, verifique estes pontos.

---

## 1. Código (já corrigido)

O link no email enviado pela função **invite-team-member** está **fixo** em `https://clinicnest.metaclass.com.br/login` (não usa mais variável de ambiente). Depois de alterar, faça o deploy:

```bash
supabase functions deploy invite-team-member
```

---

## 2. Resend – Click tracking

O **Resend** pode reescrever os links do email para rastrear cliques. O destino final costuma ser o mesmo que você colocou no HTML, mas vale conferir:

1. Acesse [Resend Dashboard](https://resend.com/domains) → **Domains**
2. Clique no domínio usado (ex.: `metaclass.com.br`)
3. Veja se **Click tracking** está ativado
4. Se estiver e o link ainda abrir URL errada, **desative** temporariamente o click tracking e teste de novo

Ao desativar, o link no email passa a ser exatamente `https://clinicnest.metaclass.com.br/login`, sem passar pelo redirect do Resend.

---

## 3. Qual email está sendo clicado?

- **Email do Resend** (assunto: "Bem-vindo à equipe do ClinicNest! 🎉")  
  → Esse é o que controlamos na Edge Function. O link desse email deve ser `https://clinicnest.metaclass.com.br/login` após o deploy acima.

- **Email do Supabase Auth** (confirmação de conta)  
  → Com `email_confirm: true` na criação do usuário, o Supabase **não** envia email de confirmação. Se mesmo assim aparecer algum email do Supabase, o link dele usa a **Site URL** do projeto (veja item 4).

---

## 4. Supabase – Site URL (Auth)

Se existir algum email de confirmação enviado pelo Supabase, o link dele usa a **Site URL** do projeto:

1. [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto
2. **Authentication** → **URL Configuration**
3. Em **Site URL**, coloque: `https://clinicnest.metaclass.com.br`
4. Em **Redirect URLs**, inclua:
   - `https://clinicnest.metaclass.com.br/**`
   - `https://clinicnest.metaclass.com.br/login`
   - `https://clinicnest.metaclass.com.br/dashboard`
5. Salve

Assim, qualquer link gerado pelo Auth (magic link, confirmação, etc.) usará `clinicnest.metaclass.com.br`.

---

## 5. Vercel – Domínio de produção

Se o link no email for `https://clinicnest.metaclass.com.br/login` mas o navegador **redirecionar** para outra URL, o problema é no Vercel/DNS:

1. [Vercel Dashboard](https://vercel.com/dashboard) → projeto do ClinicNest
2. **Settings** → **Domains**
3. Confirme que `clinicnest.metaclass.com.br` está na lista (e, se quiser, como domínio principal)
4. Veja se há algum **Redirect** ou regra que mande para outra URL e remova ou ajuste
5. No seu provedor de DNS (onde o domínio está registrado), confirme que o registro aponta para o Vercel (CNAME ou A conforme a documentação do Vercel)

Se o domínio não estiver configurado no Vercel ou no DNS, ao abrir pode cair em outra página.

---

## 6. Teste rápido

1. Envie um **novo** convite (novo membro ou outro email).
2. No email recebido, **passe o mouse** sobre o botão "Acessar o Sistema" (ou o link de login) **sem clicar** e olhe o canto inferior do navegador ou a dica que mostra a URL.
   - Se aparecer `https://resend.com/...` ou algo parecido → é click tracking do Resend; o destino final pode estar errado (veja item 2).
   - Se aparecer `https://clinicnest.metaclass.com.br/login` → o nosso código está certo; se ao clicar cair em outra URL, o problema é redirect no Vercel/DNS (item 5).
   - Se aparecer outra URL → o email é antigo ou ainda está sendo gerado com a URL errada; confirme o deploy da função e a Site URL do Supabase (itens 1 e 4).

---

## Resumo

| Onde verificar | O que fazer |
|----------------|-------------|
| **Código** | Link fixo `https://clinicnest.metaclass.com.br/login` + `supabase functions deploy invite-team-member` |
| **Resend** | Desativar click tracking no domínio (se o link ainda for errado) |
| **Supabase Auth** | Site URL = `https://clinicnest.metaclass.com.br`, Redirect URLs com `clinicnest.metaclass.com.br` |
| **Vercel/DNS** | Domínio `clinicnest.metaclass.com.br` configurado no projeto e no DNS, sem redirect indesejado |

Depois de cada alteração, teste com um **novo** convite e conferindo a URL ao passar o mouse no link antes de clicar.
