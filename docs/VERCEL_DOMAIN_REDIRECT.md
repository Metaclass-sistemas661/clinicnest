# Problema: domínio customizado redirecionando para clinicnest.vercel.app

Se ao acessar seu domínio customizado você é redirecionado para `https://clinicnest.vercel.app`, o problema está na configuração do projeto no Vercel.

---

## Passo 1: Verificar Domínios no Vercel

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione o projeto **clinicnest** (ou o nome do seu projeto)
3. Vá em **Settings** → **Domains**
4. Verifique se seu domínio customizado está listado

**O que você deve ver:**
- ✅ Seu domínio listado
- ✅ Status: **Valid** ou **Valid Configuration**
- ✅ Tipo: **Production** (não Preview ou Development)

**Se seu domínio NÃO estiver listado:**
- Clique em **Add Domain**
- Digite seu domínio
- Siga as instruções para validar o domínio

---

## Passo 2: Verificar se há Redirects configurados

1. No mesmo projeto, vá em **Settings** → **Domains**
2. Procure por **Redirects** ou **Rewrites** (pode estar em outra aba)
3. Ou vá em **Settings** → **Redirects**

**O que verificar:**
- ❌ Não deve haver nenhum redirect do seu domínio → `clinicnest.vercel.app`
- ❌ Não deve haver redirect de `*` (todos os domínios) → `clinicnest.vercel.app`

**Se houver redirects indesejados:**
- Remova-os ou ajuste para não redirecionar o domínio principal

---

## Passo 3: Verificar vercel.json (se existir)

No projeto local, verifique se existe um arquivo `vercel.json` na raiz:

```bash
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
        "destination": "https://clinicnest.vercel.app/$1",
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
2. Se seu domínio estiver listado, clique nele
3. Verifique se está marcado como **Primary Domain** ou **Production Domain**
4. Se `clinicnest.vercel.app` estiver marcado como principal, **mude para seu domínio customizado**

**Importante:** O Vercel pode usar o domínio `.vercel.app` como padrão se nenhum domínio customizado estiver configurado como principal.

---

## Passo 5: Verificar se há múltiplos projetos

Se você tem **múltiplos projetos** no Vercel:

1. Verifique qual projeto está recebendo o tráfego do seu domínio
2. Pode ser que seu domínio esteja apontando para um projeto diferente
3. No Vercel Dashboard, veja todos os projetos e verifique qual tem seu domínio configurado

---

## Passo 6: Teste direto no navegador

1. Abra uma **janela anônima/privada** do navegador
2. Acesse diretamente seu domínio
3. Veja se redireciona para `clinicnest.vercel.app`
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
   - Seu domínio customizado → **Production** (principal)
   - `clinicnest.vercel.app` → pode ficar como secundário (Vercel cria automaticamente)

2. **Redirects:**
   - Nenhum redirect do seu domínio para `vercel.app`
   - Se quiser, pode criar redirect **inverso**: `clinicnest.vercel.app` → seu domínio (opcional)

3. **vercel.json:**
   - Não deve ter redirects que afetem seu domínio

---

## Resumo rápido

| Problema | Solução |
|----------|---------|
| Seu domínio não está nos domínios do projeto | Adicionar em Settings → Domains |
| `clinicnest.vercel.app` está como domínio principal | Mudar para seu domínio como principal |
| Há redirect configurado | Remover redirect do seu domínio → `vercel.app` |
| `vercel.json` tem redirects | Remover ou ajustar redirects que afetam o domínio |
| Múltiplos projetos | Verificar qual projeto tem seu domínio configurado |

---

## Depois de corrigir

1. Faça um novo deploy (se necessário): `vercel --prod` ou via GitHub (se conectado)
2. Aguarde alguns minutos para propagação
3. Teste acessando seu domínio diretamente no navegador
4. Se funcionar, teste o link do email novamente

---

## Se ainda não funcionar

Se após seguir todos os passos o problema persistir:

1. **Verifique os logs do Vercel:**
   - Vercel Dashboard → projeto → **Deployments** → clique no último deploy → **Functions** ou **Logs**
   - Veja se há algum redirect sendo aplicado

2. **Verifique o código da aplicação:**
   - Procure por `window.location` ou `redirect` no código que possa estar forçando redirect
   - Procure por `clinicnest.vercel.app` hardcoded no código

3. **Teste com curl:**
   ```bash
   curl -I https://seudominio.com
   ```
   - Veja o header `Location:` na resposta
   - Se houver `Location: https://clinicnest.vercel.app`, há um redirect configurado
