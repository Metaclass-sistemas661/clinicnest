# Segurança – Variáveis de Ambiente (Seção 4.10)

## Frontend (Vite)

- **Use apenas variáveis com prefixo `VITE_`** no código do frontend (`import.meta.env.VITE_*`).
- Nunca exponha no frontend:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - Chaves de API privadas (Resend, etc.)
- O arquivo `.env` não deve ser commitado (está no `.gitignore`). Use `.env.example` como modelo.
- Em produção (Vercel etc.), configure as variáveis no painel do provedor; apenas `VITE_*` serão expostas no bundle.

## Edge Functions (Supabase)

- Segredos (Supabase, Stripe, Resend, Upstash) são configurados em **Supabase → Project Settings → Edge Functions → Secrets**.
- Não defina segredos em arquivos versionados.
- **SUPABASE_CORS_ORIGINS:** Em produção, defina origens permitidas (vírgula separada), ex: `https://vynlobella.com,https://www.vynlobella.com`. Sem isso, CORS usa `*`.