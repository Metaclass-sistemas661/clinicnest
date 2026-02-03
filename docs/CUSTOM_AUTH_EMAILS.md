# Emails Customizados de Autenticação

Este documento explica como os emails customizados de reset de senha e confirmação de conta funcionam.

---

## 📧 Emails Customizados

A Edge Function `send-custom-auth-email` envia emails customizados via **Resend** com o mesmo estilo visual do email de boas-vindas, mantendo consistência na comunicação.

### Tipos de Email Suportados

1. **Password Reset** (`password_reset`) - Recuperação de senha
2. **Confirmation** (`confirmation`) - Confirmação de conta (futuro)

---

## 🚀 Deploy da Edge Function

```bash
cd salon-flow
supabase functions deploy send-custom-auth-email
```

---

## ⚙️ Configuração

### Variáveis de Ambiente Necessárias

A Edge Function usa as seguintes variáveis (já configuradas):

- `RESEND_API_KEY` - Chave da API do Resend
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key do Supabase

**Verificar se estão configuradas:**
```bash
supabase secrets list
```

---

## 🔄 Como Funciona

### Reset de Senha

1. Usuário acessa `/forgot-password` e digita o email
2. Frontend chama `resetPassword(email)` do `AuthContext`
3. `AuthContext` invoca a Edge Function `send-custom-auth-email`
4. Edge Function:
   - Busca o nome do usuário no banco (se existir)
   - Gera link de recuperação usando `admin.generateLink`
   - Envia email customizado via Resend com template HTML bonito
   - Link aponta para `https://vynlobella.com/reset-password`
5. Se a Edge Function falhar, usa fallback para método padrão do Supabase

### Fallback Automático

Se a Edge Function falhar (Resend não configurado, erro de rede, etc.), o sistema automaticamente usa o método padrão do Supabase Auth, garantindo que o usuário sempre receba o email.

---

## 📝 Templates

Os templates HTML estão definidos na Edge Function:

- `getPasswordResetEmailHtml()` - Template para reset de senha
- `getPasswordResetEmailText()` - Versão texto do reset
- `getConfirmationEmailHtml()` - Template para confirmação (futuro)
- `getConfirmationEmailText()` - Versão texto da confirmação

**Estilo:** Mesmo visual do email de boas-vindas (gradiente roxo/rosa, layout profissional)

---

## 🧪 Teste

1. Acesse `/forgot-password`
2. Digite um email válido cadastrado no sistema
3. Verifique a caixa de entrada
4. O email deve ter:
   - Visual customizado (gradiente, logo VynloBella)
   - Link para `https://vynlobella.com/reset-password`
   - Nome do usuário (se disponível)

---

## 🔍 Troubleshooting

### Email não é enviado

1. **Verificar logs da Edge Function:**
   ```bash
   # No Supabase Dashboard → Edge Functions → send-custom-auth-email → Logs
   ```

2. **Verificar RESEND_API_KEY:**
   ```bash
   supabase secrets list | grep RESEND
   ```

3. **Verificar se fallback está funcionando:**
   - Se a Edge Function falhar, o sistema usa método padrão do Supabase
   - Verifique se emails padrão estão chegando

### Link errado no email

- Verificar se `redirectTo` está como `https://vynlobella.com/reset-password`
- Verificar Site URL no Supabase Dashboard (Authentication → URL Configuration)

### Nome não aparece no email

- O sistema busca o nome automaticamente do banco
- Se não encontrar, o email é enviado sem nome (funciona normalmente)

---

## 📊 Status Atual

| Funcionalidade | Status | Template |
|----------------|--------|----------|
| Reset de Senha | ✅ Implementado | Customizado Resend |
| Confirmação de Conta | ⏳ Futuro | Padrão Supabase |

---

## 🔮 Próximos Passos (Opcional)

Para customizar também o email de **confirmação de conta**:

1. Modificar `signUp` no `AuthContext` para chamar a Edge Function
2. Desabilitar email automático do Supabase (usar `email_confirm: true` e enviar manualmente)
3. Usar tipo `confirmation` na Edge Function

**Nota:** Atualmente a confirmação usa o template padrão do Supabase, que já está funcionando corretamente.
