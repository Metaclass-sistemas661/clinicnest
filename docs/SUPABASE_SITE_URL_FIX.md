# Corrigir Site URL no Supabase para Links de Confirmação

O problema é que o **Supabase Auth** está gerando links de confirmação usando `salon-flow-ten.vercel.app` em vez de `vynlobella.com`.

---

## ⚠️ Problema Identificado

Quando um usuário se cadastra ou recebe um email de confirmação do Supabase Auth, o link no email aponta para `salon-flow-ten.vercel.app` porque a **Site URL** configurada no Supabase Dashboard está com esse valor.

---

## ✅ Solução: Atualizar Site URL no Supabase Dashboard

### Passo 1: Acessar Configurações de Auth

1. Acesse: https://supabase.com/dashboard/project/pijjuhtyxcidqceukogv/auth/url-configuration
2. Ou: Supabase Dashboard → seu projeto → **Authentication** → **URL Configuration**

### Passo 2: Atualizar Site URL

1. No campo **Site URL**, altere para:
   ```
   https://vynlobella.com
   ```

2. **Remova** ou **não use** `https://salon-flow-ten.vercel.app` como Site URL

### Passo 3: Configurar Redirect URLs

Na mesma página, em **Redirect URLs**, adicione/verifique:

```
https://vynlobella.com/**
https://vynlobella.com/login
https://vynlobella.com/dashboard
https://vynlobella.com
```

**Importante:** Remova URLs com `vercel.app` se não forem necessárias.

### Passo 4: Salvar

Clique em **Save** ou **Update** para salvar as alterações.

---

## 🔧 Correção no Código (já aplicada)

O código em `src/contexts/AuthContext.tsx` foi atualizado para usar `https://vynlobella.com/login` fixo ao invés de `window.location.origin`, evitando que o redirect varie entre dispositivos.

---

## 📧 Como Funciona

### Antes (problema):
- Site URL no Supabase: `salon-flow-ten.vercel.app`
- Link de confirmação gerado: `https://salon-flow-ten.vercel.app/auth/v1/verify?token=...`
- Usuário clica → vai para `vercel.app`

### Depois (corrigido):
- Site URL no Supabase: `https://vynlobella.com`
- Link de confirmação gerado: `https://vynlobella.com/auth/v1/verify?token=...`
- `emailRedirectTo` fixo: `https://vynlobella.com/login`
- Usuário clica → vai para `vynlobella.com/login`

---

## ✅ Teste

Depois de atualizar a Site URL no Supabase:

1. **Cadastre um novo usuário** (ou peça para alguém se cadastrar)
2. **Verifique o email de confirmação** recebido
3. **Clique no link** (pode ser no mobile ou desktop)
4. **Deve redirecionar para:** `https://vynlobella.com/login`

---

## 🔍 Verificação Adicional

Se ainda não funcionar após atualizar a Site URL:

1. **Limpe o cache** do Supabase (pode levar alguns minutos para propagar)
2. **Verifique se há múltiplos projetos** no Supabase e confirme que está editando o projeto correto (`pijjuhtyxcidqceukogv`)
3. **Aguarde 5-10 minutos** após salvar para que as mudanças sejam aplicadas

---

## 📝 Resumo

| O que fazer | Onde fazer |
|-------------|------------|
| Atualizar Site URL | Supabase Dashboard → Authentication → URL Configuration |
| Configurar Redirect URLs | Mesma página, adicionar `vynlobella.com/**` |
| Código já corrigido | `src/contexts/AuthContext.tsx` usa URL fixa |

**Ação necessária:** Atualizar Site URL no Supabase Dashboard para `https://vynlobella.com`
