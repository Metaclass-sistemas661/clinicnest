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

Assim a validação do JWT fica centralizada e não é preciso repetir a lógica em cada função.
