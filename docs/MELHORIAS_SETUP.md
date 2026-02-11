# Configuração das Melhorias Implementadas

## Melhorias do Diagnóstico (2025)

- **Webhooks:** Doc consolidado em `docs/WEBHOOK_STRIPE_DEPLOY.md`. CORS em produção: `SUPABASE_CORS_ORIGINS` (ver `docs/SEGURANCA_ENV.md`).
- **Contato:** Formulário salva em `contact_messages`.
- **Validação RPCs:** `pay_salary` e `complete_appointment_with_sale` validam inputs (dias negativos, quantidade negativa).
- **Logger:** `maskSensitive()` para dados sensíveis em logs.

---

## 1. Formulário de Contato (Supabase)

O formulário de contato salva mensagens na tabela `contact_messages`.

**Passo:** Execute a migration no seu projeto Supabase:

```bash
supabase db push
```

Ou execute manualmente o SQL em `supabase/migrations/20260202180000_contact_messages.sql`.

**Como ver as mensagens:** No Dashboard do Supabase → Table Editor → `contact_messages`.

---

## 2. Google Analytics 4

O Google Analytics **não precisa de API key**. Usa o **Measurement ID** (formato: G-XXXXXXXXXX).

**Passos:**
1. Crie uma propriedade em [analytics.google.com](https://analytics.google.com)
2. Obtenha o Measurement ID (Admin → Data Streams → Web → Measurement ID)
3. Adicione ao seu `.env` ou variáveis de ambiente:

```
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

4. Faça o deploy ou rode com a variável definida. Se não estiver definida, o Analytics não carrega (não quebra o app).

---

## 3. Imagem OG (Redes Sociais) ✅

A imagem `og-image.png` está em `public/` (1200×630 px). Usada no compartilhamento em WhatsApp, Facebook, LinkedIn.

---

## 4. PWA (Manifest) ✅

O `manifest.json` inclui ícones 192×192 e 512×512 em `public/icon-192.png` e `public/icon-512.png`. Permite instalar o app na tela inicial em dispositivos móveis.

---

## 5. Sitemap (SEO) ✅

O `sitemap.xml` está em `public/`. O `robots.txt` referencia `https://vynlobella.com/sitemap.xml`. Se usar outro domínio, atualize a URL em ambos os arquivos.

---

## 6. Onboarding

O modal de boas-vindas aparece na primeira visita ao Dashboard. Usa `localStorage` com chave `vynlobella_onboarding_seen`.

Para resetar (testar de novo): no console do navegador:
```js
localStorage.removeItem('vynlobella_onboarding_seen')
```
