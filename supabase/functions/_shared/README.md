# Shared utilities para Edge Functions

## Autenticação (usuário logado)

Para **qualquer** função chamada pelo frontend com o usuário logado (JWT no `Authorization`):

1. Importe o helper:
   ```ts
   import { getAuthenticatedUser } from "../_shared/auth.ts";
   ```

2. No início do handler (depois do OPTIONS):
   ```ts
   const authResult = await getAuthenticatedUser(req, corsHeaders);
   if (authResult.error) return authResult.error;
   const user = authResult.user;
   ```

3. Use `user` (ex.: `user.id`) e, se precisar de operações admin, crie o cliente com `SUPABASE_SERVICE_ROLE_KEY` e use só para a ação privilegiada.

Para operações que exigem **tenant_id** (ex.: convite de membros, recursos por tenant), use `getAuthenticatedUserWithTenant(req, cors)` (Seção 4.6). Ele valida o JWT e garante que o perfil tem `tenant_id` antes de prosseguir.

Assim a validação do JWT fica centralizada e não é preciso repetir a lógica em cada função.

## Logging (4.3 – dados sensíveis)

O `createLogger` de `_shared/logging.ts` mascara automaticamente PII, valores monetários e tokens antes de logar. Em produção, não defina `LOG_SENSITIVE`. Para ver dados completos em desenvolvimento, defina o secret `LOG_SENSITIVE=true` nas Edge Functions.

## CORS

Por padrão usa-se `corsHeaders` com `*`. Para **restringir origens em produção**, defina no Supabase (Settings → Edge Functions → Secrets) o secret `SUPABASE_CORS_ORIGINS` com origens separadas por vírgula (ex.: `https://beautygest.metaclass.com.br`). Em seguida, nas funções, troque o uso de `corsHeaders` por `getCorsHeaders(req)` (import de `_shared/cors.ts`) e use o retorno nos headers das respostas.
