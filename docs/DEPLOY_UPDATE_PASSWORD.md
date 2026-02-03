# Deploy da Função update-password

## ⚠️ Problema Atual

A função `update-password` não está sendo chamada (sem logs). Isso pode ser porque:

1. **Função não foi deployada ainda**
2. **Código em cache no navegador** (versão antiga)
3. **Erro silencioso** na chamada

---

## ✅ Solução: Deploy da Função

### Passo 1: Deploy

```bash
cd C:\Users\andre\Desktop\Vynlobella\salon-flow
supabase functions deploy update-password
```

### Passo 2: Limpar Cache do Navegador

1. Abra o navegador
2. Pressione **Ctrl + Shift + Delete** (ou Cmd + Shift + Delete no Mac)
3. Selecione **"Imagens e arquivos em cache"**
4. Clique em **"Limpar dados"**
5. Ou use **Ctrl + F5** para forçar reload da página

### Passo 3: Testar

1. Acesse `/forgot-password`
2. Solicite recuperação de senha
3. Clique no link do email
4. Altere a senha
5. **Abra o Console do navegador (F12)** e veja os logs:
   - Deve aparecer: `[ResetPassword] Chamando Edge Function update-password`
   - Deve aparecer: `[ResetPassword] Resposta da Edge Function`

---

## 🔍 Verificar se Deploy Funcionou

### No Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard/project/pijjuhtyxcidqceukogv/functions
2. Verifique se `update-password` está listada
3. Clique em `update-password` → **Logs**
4. Quando você alterar a senha, deve aparecer logs como:
   - `[update-password] Request recebido`
   - `[update-password] Usuário autenticado`
   - `[update-password] Senha atualizada com sucesso`

---

## 🐛 Se Ainda Não Funcionar

### Verificar Console do Navegador:

1. Abra **F12** → **Console**
2. Altere a senha
3. Veja se aparece algum erro em vermelho
4. Veja se aparece os logs `[ResetPassword]`

**Erros comuns:**

- `Function not found` → Função não foi deployada
- `Unauthorized` → Problema de autenticação/sessão
- `Network error` → Problema de conexão

### Verificar se Código Está Atualizado:

1. No navegador, pressione **Ctrl + Shift + I**
2. Vá em **Network** (Rede)
3. Recarregue a página (`Ctrl + R`)
4. Procure por `ResetPassword` ou `update-password` nos arquivos carregados
5. Verifique se o código está atualizado

---

## 📝 Checklist

- [ ] Função `update-password` deployada (`supabase functions deploy update-password`)
- [ ] Cache do navegador limpo (Ctrl + F5)
- [ ] Console do navegador aberto (F12)
- [ ] Testado alteração de senha
- [ ] Verificado logs no Supabase Dashboard

---

## 🔄 Fallback Automático

Se a Edge Function falhar por qualquer motivo, o código automaticamente usa o método padrão do Supabase (`updateUser`), garantindo que a senha seja atualizada mesmo se a função não estiver disponível.
