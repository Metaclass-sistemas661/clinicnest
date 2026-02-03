# Desabilitar Email Automático do Supabase Auth

O Supabase Auth envia automaticamente um email quando a senha é alterada via `updateUser({ password })`. Para usar apenas nosso email customizado, precisamos desabilitar isso no Dashboard.

---

## ⚙️ Configuração no Supabase Dashboard

### Opção 1: Desabilitar Email de Alteração de Senha (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/pijjuhtyxcidqceukogv/auth/templates
2. Ou: Supabase Dashboard → seu projeto → **Authentication** → **Email Templates**
3. Procure por **"Change Email Address"** ou **"Password Change"**
4. **Desabilite** o template de alteração de senha ou configure para não enviar automaticamente

**Nota:** Pode não haver uma opção direta para desabilitar. Nesse caso, use a Opção 2.

### Opção 2: Customizar Template do Supabase (Temporário)

Se não conseguir desabilitar completamente:

1. No mesmo local (Email Templates)
2. Edite o template **"Password Change"**
3. Deixe o conteúdo mínimo ou vazio
4. Isso fará com que o email padrão seja menos visível

**Limitação:** O Supabase ainda enviará um email, mas com conteúdo mínimo.

### Opção 3: Usar Edge Function para Atualizar Senha (Melhor Solução)

Criar uma Edge Function que atualiza a senha usando `admin.updateUserById` sem trigger de email automático, e então envia nosso email customizado.

---

## 🔧 Solução Implementada Atual

Atualmente, nosso código:

1. ✅ Atualiza a senha via `updateUser({ password })` → Supabase envia email automático
2. ✅ Chama Edge Function para enviar email customizado → Nosso email customizado

**Resultado:** O usuário recebe **2 emails**:
- Email padrão do Supabase (feio)
- Email customizado nosso (bonito)

---

## ✅ Solução Ideal: Edge Function para Atualizar Senha

Para evitar o email automático do Supabase, podemos criar uma Edge Function que:

1. Recebe a nova senha e token de autenticação
2. Atualiza a senha usando `admin.updateUserById` (não envia email automático)
3. Envia nosso email customizado

**Vantagens:**
- Apenas 1 email (o nosso customizado)
- Controle total sobre o processo
- Visual profissional consistente

**Desvantagens:**
- Requer criar nova Edge Function
- Mais complexo

---

## 📝 Próximos Passos

**Opção A - Rápida (atual):**
- Deixar como está (2 emails, mas nosso é bonito)
- Desabilitar template no Dashboard se possível

**Opção B - Ideal:**
- Criar Edge Function `update-password` que atualiza senha e envia email customizado
- Modificar `ResetPassword.tsx` para chamar essa função ao invés de `updateUser`

Qual opção você prefere?
