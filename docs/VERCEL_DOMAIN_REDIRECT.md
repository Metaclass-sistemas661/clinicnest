# Problema: vynlobella.com redirecionando para salon-flow-ten.vercel.app

Se ao acessar `https://vynlobella.com` você é redirecionado para `https://salon-flow-ten.vercel.app`, o problema está na configuração do projeto no Vercel.

---

## Passo 1: Verificar Domínios no Vercel

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione o projeto **salon-flow** (ou o nome do seu projeto)
3. Vá em **Settings** → **Domains**
4. Verifique se `vynlobella.com` está listado como domínio

**O que você deve ver:**
- ✅ `vynlobella.com` listado como domínio
- ✅ Status: **Valid** ou **Valid Configuration**
- ✅ Tipo: **Production** (não Preview ou Development)

**Se `vynlobella.com` NÃO estiver listado:**
- Clique em **Add Domain**
- Digite `vynlobella.com`
- Siga as instruções para validar o domínio

---

## Passo 2: Verificar se há Redirects configurados

1. No mesmo projeto, vá em **Settings** → **Domains**
2. Procure por **Redirects** ou **Rewrites** (pode estar em outra aba)
3. Ou vá em **Settings** → **Redirects**

**O que verificar:**
- ❌ Não deve haver nenhum redirect de `vynlobella.com` → `salon-flow-ten.vercel.app`
- ❌ Não deve haver redirect de `*` (todos os domínios) → `salon-flow-ten.vercel.app`

**Se houver redirects indesejados:**
- Remova-os ou ajuste para não redirecionar o domínio principal

---

## Passo 3: Verificar vercel.json (se existir)

No projeto local, verifique se existe um arquivo `vercel.json` na raiz:

```bash
cd C:\Users\andre\Desktop\Vynlobella\salon-flow
cat vercel.json
```

**O que verificar:**
- Se existir `redirects` ou `rewrites` que redirecionam para `vercel.app`, remova ou ajuste
- Exemplo de problema:
  ```json
  {
    "redirects": [
      {
        "source": "/(.*)",
        "destination": "https://salon-flow-ten.vercel.app/$1",
        "permanent": true
      }
    ]
  }
  ```
- Isso causaria redirect de todos os domínios para vercel.app

**Se não existir `vercel.json`:**
- Não é necessário criar um

---

## Passo 4: Verificar configuração do domínio principal

No Vercel:

1. **Settings** → **Domains**
2. Se `vynlobella.com` estiver listado, clique nele
3. Verifique se está marcado como **Primary Domain** ou **Production Domain**
4. Se `salon-flow-ten.vercel.app` estiver marcado como principal, **mude para `vynlobella.com`**

**Importante:** O Vercel pode usar o domínio `.vercel.app` como padrão se nenhum domínio customizado estiver configurado como principal.

---

## Passo 5: Verificar se há múltiplos projetos

Se você tem **múltiplos projetos** no Vercel:

1. Verifique qual projeto está recebendo o tráfego de `vynlobella.com`
2. Pode ser que `vynlobella.com` esteja apontando para um projeto diferente
3. No Vercel Dashboard, veja todos os projetos e verifique qual tem `vynlobella.com` configurado

---

## Passo 6: Teste direto no navegador

1. Abra uma **janela anônima/privada** do navegador
2. Acesse diretamente: `https://vynlobella.com`
3. Veja se redireciona para `salon-flow-ten.vercel.app`
4. Se redirecionar, o problema está no Vercel (não no email)

**Se redirecionar:**
- O problema é configuração do Vercel (domínio não configurado como principal ou redirect ativo)
- Siga os passos acima

**Se NÃO redirecionar:**
- O problema pode ser no Resend (click tracking reescrevendo o link)
- Ou o email que está sendo clicado é antigo (de antes da correção)

---

## Passo 7: Configuração recomendada no Vercel

**Configuração ideal:**

1. **Domains:**
   - `vynlobella.com` → **Production** (principal)
   - `salon-flow-ten.vercel.app` → pode ficar como secundário (Vercel cria automaticamente)

2. **Redirects:**
   - Nenhum redirect de `vynlobella.com` para `vercel.app`
   - Se quiser, pode criar redirect **inverso**: `salon-flow-ten.vercel.app` → `vynlobella.com` (opcional)

3. **vercel.json:**
   - Não deve ter redirects que afetem `vynlobella.com`

---

## Resumo rápido

| Problema | Solução |
|----------|---------|
| `vynlobella.com` não está nos domínios do projeto | Adicionar em Settings → Domains |
| `salon-flow-ten.vercel.app` está como domínio principal | Mudar para `vynlobella.com` como principal |
| Há redirect configurado | Remover redirect de `vynlobella.com` → `vercel.app` |
| `vercel.json` tem redirects | Remover ou ajustar redirects que afetam o domínio |
| Múltiplos projetos | Verificar qual projeto tem `vynlobella.com` configurado |

---

## Depois de corrigir

1. Faça um novo deploy (se necessário): `vercel --prod` ou via GitHub (se conectado)
2. Aguarde alguns minutos para propagação
3. Teste acessando `https://vynlobella.com` diretamente no navegador
4. Se funcionar, teste o link do email novamente

---

## Se ainda não funcionar

Se após seguir todos os passos o problema persistir:

1. **Verifique os logs do Vercel:**
   - Vercel Dashboard → projeto → **Deployments** → clique no último deploy → **Functions** ou **Logs**
   - Veja se há algum redirect sendo aplicado

2. **Verifique o código da aplicação:**
   - Procure por `window.location` ou `redirect` no código que possa estar forçando redirect
   - Procure por `salon-flow-ten.vercel.app` hardcoded no código

3. **Teste com curl:**
   ```bash
   curl -I https://vynlobella.com
   ```
   - Veja o header `Location:` na resposta
   - Se houver `Location: https://salon-flow-ten.vercel.app`, há um redirect configurado
