# Como Testar o Link do Email

Para identificar exatamente onde está o problema, siga estes passos:

---

## Teste 1: Verificar o link no email (sem clicar)

1. Abra o email de convite ou boas-vindas
2. **NÃO clique** no botão ainda
3. **Passe o mouse** sobre o botão "Acessar o Sistema"
4. Olhe no **canto inferior esquerdo** do navegador (ou na tooltip que aparece)
5. **Anote a URL completa** que aparece

**Resultados possíveis:**

| URL que aparece | Significa |
|-----------------|-----------|
| `https://clinicnest.metaclass.com.br/login` | ✅ Link correto no email. Se ao clicar vai para vercel.app, problema é Vercel/DNS |
| `https://resend.com/...` ou `https://resend.io/...` | ⚠️ Resend está usando click tracking. O destino final pode estar errado |
| `https://clinicnest.vercel.app/login` | ❌ Link errado no email. Código não foi atualizado ou há outro lugar gerando o link |

---

## Teste 2: Ver código-fonte do email

1. No cliente de email (Gmail, Outlook, etc.), abra o email
2. Procure por **"Ver código-fonte"** ou **"View source"** ou **"Mostrar original"**
3. Procure por `href=` ou `https://` no código
4. Veja qual URL está no link do botão

**O que procurar:**
- Procure por: `<a href="https://...`
- Deve encontrar algo como: `<a href="https://clinicnest.metaclass.com.br/login"`

---

## Teste 3: Testar acesso direto ao domínio

1. Abra uma **janela anônima/privada**
2. Acesse diretamente: `https://clinicnest.metaclass.com.br`
3. Veja o que acontece:
   - ✅ Carrega o site normalmente → DNS/Vercel OK
   - ❌ Redireciona para `clinicnest.vercel.app` → Problema no Vercel
   - ❌ Erro de certificado SSL → Problema de DNS/certificado
   - ❌ Página não encontrada → Domínio não configurado no Vercel

---

## Teste 4: Verificar logs da Edge Function

Para ver qual URL está sendo gerada no código:

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto
2. Vá em **Edge Functions** → **invite-team-member**
3. Clique em **Logs**
4. Procure por uma linha que diz: `"URL do link no email (fixa)"`
5. Veja o valor de `loginUrl` nos logs

**Se aparecer:**
- `"loginUrl": "https://clinicnest.metaclass.com.br/login"` → ✅ Código está correto
- `"loginUrl": "https://clinicnest.vercel.app/login"` → ❌ Variável de ambiente ainda está errada

---

## Diagnóstico Baseado nos Testes

### Cenário A: Link no email é `clinicnest.metaclass.com.br` mas redireciona para `vercel.app`

**Causa:** Configuração do Vercel ou DNS

**Solução:**
1. Vercel Dashboard → Settings → Domains
2. Verifique se `clinicnest.metaclass.com.br` está configurado como **Production**
3. Verifique se não há redirects configurados
4. Verifique se o certificado SSL está válido

---

### Cenário B: Link no email é `resend.com/...` (click tracking)

**Causa:** Resend está reescrevendo o link

**Solução:**
1. Resend Dashboard → Domains → seu domínio
2. Desative **Click Tracking**
3. Ou verifique se o destino final do redirect está correto

---

### Cenário C: Link no email é `clinicnest.vercel.app`

**Causa:** Código não atualizado ou variável de ambiente errada

**Solução:**
1. Verifique os logs da Edge Function (Teste 4)
2. Se o log mostrar `clinicnest.metaclass.com.br`, o problema é no Resend
3. Se o log mostrar `vercel.app`, refaça:
   ```bash
   supabase secrets set SITE_URL=https://clinicnest.metaclass.com.br
   supabase functions deploy invite-team-member
   ```

---

## Próximos Passos

Depois de fazer os testes acima, informe:

1. **Qual URL aparece** quando passa o mouse no botão do email?
2. **O que acontece** quando acessa `https://clinicnest.metaclass.com.br` diretamente?
3. **O que aparece** nos logs da Edge Function?

Com essas informações, conseguiremos identificar exatamente onde está o problema.
