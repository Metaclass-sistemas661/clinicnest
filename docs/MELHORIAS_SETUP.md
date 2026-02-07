# Configuração das Melhorias Implementadas

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

## 3. Imagem OG (Redes Sociais)

O `index.html` já referencia `/og-image.png`. Adicione uma imagem em:

```
public/og-image.png
```

**Recomendado:** 1200×630 px, com logo VynloBella e tagline para compartilhamento em WhatsApp, Facebook, LinkedIn.

---

## 4. PWA (Manifest)

O `manifest.json` está em `public/`. O favicon é usado como ícone. Para ícones melhores em instalação:

- Adicione `public/icon-192.png` e `public/icon-512.png`
- Atualize `manifest.json` com as novas entradas em `icons`

---

## 5. Onboarding

O modal de boas-vindas aparece na primeira visita ao Dashboard. Usa `localStorage` com chave `vynlobella_onboarding_seen`.

Para resetar (testar de novo): no console do navegador:
```js
localStorage.removeItem('vynlobella_onboarding_seen')
```
