# Corrigir Site URL no Supabase para Links de Confirmação

O problema é que o **Supabase Auth** está gerando links de confirmação usando a URL errada em vez do domínio de produção.

---

## ⚠️ Problema Identificado

Quando um usuário se cadastra ou recebe um email de confirmação do Supabase Auth, o link no email pode apontar para a URL errada porque a **Site URL** configurada no Supabase Dashboard está incorreta.

---

## ✅ Solução: Atualizar Site URL no Supabase Dashboard

### Passo 1: Acessar Configurações de Auth

1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_REF/auth/url-configuration
2. Ou: Supabase Dashboard → seu projeto → **Authentication** → **URL Configuration**

### Passo 2: Atualizar Site URL

1. No campo **Site URL**, altere para:
   ```
   https://clinicnest.metaclass.com.br
   ```

2. **Remova** ou **não use** URLs de desenvolvimento como Site URL

### Passo 3: Configurar Redirect URLs

Na mesma página, em **Redirect URLs**, adicione/verifique:

```
https://clinicnest.metaclass.com.br/**
https://clinicnest.metaclass.com.br/login
https://clinicnest.metaclass.com.br/dashboard
https://clinicnest.metaclass.com.br
```

**Importante:** Remova URLs de desenvolvimento se não forem necessárias.

### Passo 4: Salvar

Clique em **Save** ou **Update** para salvar as alterações.

---

## 🔧 Correção no Código (já aplicada)

O código em `src/contexts/AuthContext.tsx` foi atualizado para usar `https://clinicnest.metaclass.com.br/login` fixo ao invés de `window.location.origin`, evitando que o redirect varie entre dispositivos.

---

## 📧 Como Funciona

### Antes (problema):
- Site URL no Supabase: URL de desenvolvimento
- Link de confirmação gerado: URL errada
- Usuário clica → vai para URL errada

### Depois (corrigido):
- Site URL no Supabase: `https://clinicnest.metaclass.com.br`
- Link de confirmação gerado: `https://clinicnest.metaclass.com.br/auth/v1/verify?token=...`
- `emailRedirectTo` fixo: `https://clinicnest.metaclass.com.br/login`
- Usuário clica → vai para `clinicnest.metaclass.com.br/login`

---

## ✅ Teste

Depois de atualizar a Site URL no Supabase:

1. **Cadastre um novo usuário** (ou peça para alguém se cadastrar)
2. **Verifique o email de confirmação** recebido
3. **Clique no link** (pode ser no mobile ou desktop)
4. **Deve redirecionar para:** `https://clinicnest.metaclass.com.br/login`

---

## 🔍 Verificação Adicional

Se ainda não funcionar após atualizar a Site URL:

1. **Limpe o cache** do Supabase (pode levar alguns minutos para propagar)
2. **Verifique se há múltiplos projetos** no Supabase e confirme que está editando o projeto correto
3. **Aguarde 5-10 minutos** após salvar para que as mudanças sejam aplicadas

---

## 📝 Resumo

| O que fazer | Onde fazer |
|-------------|------------|
| Atualizar Site URL | Supabase Dashboard → Authentication → URL Configuration |
| Configurar Redirect URLs | Mesma página, adicionar `clinicnest.metaclass.com.br/**` |
| Código já corrigido | `src/contexts/AuthContext.tsx` usa URL fixa |

**Ação necessária:** Atualizar Site URL no Supabase Dashboard para `https://clinicnest.metaclass.com.br`
